import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { PaginatedErrorsDto } from './dto/paginated-errors.dto';

const EHR_IMPORT_MAX_RETRIES = 3;
const SOURCE_ROW_MAX_LENGTH = 200;

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
    tenantId?: string,
    createdBy?: string,
  ): Promise<{ jobId: string; importBatchId: string }> {
    const format = this._detectFormat(originalName, fileBuffer);
    const importBatchId = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');

    const existing = await this.jobRepo.findOne({ where: { importBatchId, tenantId } });
    if (existing && existing.status === ImportJobStatus.COMPLETED) {
      return { jobId: existing.id, importBatchId };
    }

    const job = await this.jobRepo.save(
      this.jobRepo.create({ importBatchId, format, dryRun, quarantineMode, tenantId, createdBy }),
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
      tenantId,
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

  async getStatus(jobId: string, tenantId?: string): Promise<JobStatus> {
    const job = await this._findJobForTenant(jobId, tenantId);
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

  async exportErrors(jobId: string, tenantId?: string): Promise<string> {
    await this._findJobForTenant(jobId, tenantId);
    const errors = await this.errorRepo.find({ where: { jobId } });
    const header = 'rowIndex,errorMessage,sourceRow';
    const rows = errors.map(
      (e) =>
        `${e.rowIndex},"${e.errorMessage.replace(/"/g, '""')}","${this._redactSourceRow(e.sourceRow).replace(/"/g, '""')}"`,
    );
    return [header, ...rows].join('\n');
  }

  async getErrors(jobId: string, page = 1, limit = 20, tenantId?: string): Promise<PaginatedErrorsDto> {
    await this._findJobForTenant(jobId, tenantId);
    const [errors, total] = await this.errorRepo.findAndCount({
      where: { jobId },
      order: { rowIndex: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: errors.map((e) => ({
        rowIndex: e.rowIndex,
        errorMessage: e.errorMessage,
        sourceRow: this._redactSourceRow(e.sourceRow),
      })),
      total,
      page,
      limit,
    };
  }

  async reprocess(jobId: string, tenantId?: string): Promise<{ newJobId: string; reprocessedCount: number }> {
    const job = await this._findJobForTenant(jobId, tenantId);
    const failedErrors = await this.errorRepo.find({ where: { jobId } });
    if (failedErrors.length === 0) {
      return { newJobId: jobId, reprocessedCount: 0 };
    }
    const newJob = await this.jobRepo.save(
      this.jobRepo.create({
        importBatchId: `reprocess-${jobId}-${Date.now()}`,
        format: job.format,
        dryRun: job.dryRun,
        quarantineMode: job.quarantineMode,
        tenantId: job.tenantId,
        createdBy: job.createdBy,
      }),
    );
    const jobDto = {
      jobId: newJob.id,
      tempFilePath: null,
      originalName: `reprocess-${jobId}`,
      format: job.format,
      dryRun: job.dryRun,
      reprocessFromJobId: jobId,
      failedRowIndices: failedErrors.map((e) => e.rowIndex),
      tenantId: job.tenantId,
    };
    const maxRetries = this.configService.get<number>('EHR_IMPORT_MAX_RETRIES', EHR_IMPORT_MAX_RETRIES);
    await this.importQueue.add('reprocess', jobDto, {
      jobId: newJob.id,
      attempts: maxRetries,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    return { newJobId: newJob.id, reprocessedCount: failedErrors.length };
  }

  private async _findJobForTenant(jobId: string, tenantId?: string): Promise<ImportJob> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || (tenantId !== undefined && job.tenantId !== tenantId)) {
      throw new NotFoundException(`Import job ${jobId} not found`);
    }
    return job;
  }

  private _redactSourceRow(sourceRow: string | null | undefined): string {
    if (!sourceRow) return '';
    if (sourceRow.length <= SOURCE_ROW_MAX_LENGTH) return sourceRow;
    return `${sourceRow.slice(0, SOURCE_ROW_MAX_LENGTH)}…[truncated]`;
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