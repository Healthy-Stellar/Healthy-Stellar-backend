import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { EhrImportJobDto } from '../queues/dto/ehr-import-job.dto';
import { ImportJob, ImportJobStatus, ImportFormat } from './entities/import-job.entity';
import { ImportError } from './entities/import-error.entity';
import { Record as RecordEntity } from '../records/entities/record.entity';
import { CsvColumnMap } from './parsers/csv.parser';
import { TempStorageService } from './services/temp-storage.service';
import { ConfigService } from '@nestjs/config';

const EHR_IMPORT_MAX_RETRIES = 3;

export interface JobStatus {
  jobId: string;
  status: ImportJobStatus;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skippedDuplicate: number;
  quarantined: number;
  errors: Array<{ rowIndex: number; errorMessage: string }>;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    @InjectRepository(ImportJob)
    private readonly jobRepo: Repository<ImportJob>,
    @InjectRepository(ImportError)
    private readonly errorRepo: Repository<ImportError>,
    @InjectRepository(RecordEntity)
    private readonly recordRepo: Repository<RecordEntity>,
    @InjectQueue(QUEUE_NAMES.EHR_IMPORT)
    private readonly importQueue: Queue,
    private readonly tempStorage: TempStorageService,
    private readonly configService: ConfigService,
  ) {}

  async enqueue(
    fileBuffer: Buffer,
    originalName: string,
    dryRun = false,
    columnMap?: CsvColumnMap,
    quarantineMode = false,
  ): Promise<{ jobId: string; importBatchId: string }> {
    const format = this._detectFormat(originalName, fileBuffer);
    const importBatchId = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');

    const existing = await this.jobRepo.findOne({ where: { importBatchId } });
    if (existing && existing.status === ImportJobStatus.COMPLETED) {
      return { jobId: existing.id, importBatchId };
    }

    const job = await this.jobRepo.save(
      this.jobRepo.create({ importBatchId, format, dryRun, quarantineMode }),
    );

    const tempFilePath = await this.tempStorage.writeBuffer(job.id, fileBuffer, originalName);

    const jobDto: EhrImportJobDto = {
      jobId: job.id,
      tempFilePath,
      originalName,
      format,
      dryRun,
      quarantineMode,
      columnMap,
    };

    const maxRetries = this.configService.get<number>('EHR_IMPORT_MAX_RETRIES', EHR_IMPORT_MAX_RETRIES);

    await this.importQueue.add('process', jobDto, {
      jobId: job.id,
      attempts: maxRetries,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    });

    return { jobId: job.id, importBatchId };
  }

  async getStatus(jobId: string): Promise<JobStatus> {
    const job = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
    const errors = await this.errorRepo.find({ where: { jobId } });
    return {
      jobId: job.id,
      status: job.status,
      total: job.total,
      processed: job.processed,
      succeeded: job.succeeded,
      failed: job.failed,
      skippedDuplicate: job.skippedDuplicate,
      quarantined: job.quarantined,
      errors: errors.map((e) => ({ rowIndex: e.rowIndex, errorMessage: e.errorMessage })),
    };
  }

  async exportErrors(jobId: string): Promise<string> {
    const errors = await this.errorRepo.find({ where: { jobId } });
    const header = 'rowIndex,errorMessage,sourceRow';
    const rows = errors.map(
      (e) =>
        `${e.rowIndex},"${e.errorMessage.replace(/"/g, '""')}","${e.sourceRow.replace(/"/g, '""')}"`,
    );
    return [header, ...rows].join('\n');
  }

  private _detectFormat(filename: string, buffer: Buffer): ImportFormat {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'csv') return ImportFormat.CSV;
    if (ext === 'xml' || ext === 'ccd' || ext === 'ccda') return ImportFormat.CCD;
    if (ext === 'hl7' || ext === 'txt') return ImportFormat.HL7;
    const head = buffer.slice(0, 10).toString();
    if (head.startsWith('MSH|')) return ImportFormat.HL7;
    if (head.trimStart().startsWith('<')) return ImportFormat.CCD;
    return ImportFormat.CSV;
  }
}