import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, BadRequestException } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { EhrImportJobDto } from '../queues/dto/ehr-import-job.dto';
import { ImportJob, ImportJobStatus, ImportFormat } from './entities/import-job.entity';
import { ImportError } from './entities/import-error.entity';
import { Record as RecordEntity } from '../records/entities/record.entity';
import { Hl7Parser } from './parsers/hl7.parser';
import { CcdParser } from './parsers/ccd.parser';
import { CsvParser, CsvColumnMap } from './parsers/csv.parser';
import { ParsedRecord } from './parsers/parsed-record.interface';
import { IpfsService } from '../records/services/ipfs.service';
import { StellarService } from '../records/services/stellar.service';
import { TempStorageService } from './services/temp-storage.service';
import { DeduplicationService } from './services/deduplication.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const STELLAR_BATCH_SIZE = 50;

@Processor(QUEUE_NAMES.EHR_IMPORT, {
  concurrency: 2,
})
export class EhrImportProcessor extends WorkerHost {
  private readonly logger = new Logger(EhrImportProcessor.name);

  constructor(
    @InjectRepository(ImportJob)
    private readonly jobRepo: Repository<ImportJob>,
    @InjectRepository(ImportError)
    private readonly errorRepo: Repository<ImportError>,
    @InjectRepository(RecordEntity)
    private readonly recordRepo: Repository<RecordEntity>,
    private readonly hl7Parser: Hl7Parser,
    private readonly ccdParser: CcdParser,
    private readonly csvParser: CsvParser,
    private readonly ipfs: IpfsService,
    private readonly stellar: StellarService,
    private readonly tempStorage: TempStorageService,
    private readonly deduplication: DeduplicationService,
    @InjectQueue(QUEUE_NAMES.EHR_IMPORT)
    private readonly importQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<EhrImportJobDto>): Promise<void> {
    const { jobId, tempFilePath, originalName, format, dryRun, columnMap, quarantineMode } = job.data;
    this.logger.log(`Processing EHR import job ${jobId} from ${tempFilePath}`);

    await this.jobRepo.update(jobId, { status: ImportJobStatus.PROCESSING });

    let buffer: Buffer;
    try {
      buffer = await this.tempStorage.readFile(tempFilePath);
    } catch (err) {
      await this.jobRepo.update(jobId, {
        status: ImportJobStatus.FAILED,
        errorMessage: `Failed to read temp file: ${err.message}`,
      });
      throw err;
    }

    let records: ParsedRecord[];
    try {
      records = await this._parse(format, buffer, columnMap);
    } catch (err) {
      await this.jobRepo.update(jobId, {
        status: ImportJobStatus.FAILED,
        errorMessage: err.message,
      });
      throw err;
    }

    await this.jobRepo.update(jobId, { total: records.length });

    let succeeded = 0;
    let failed = 0;
    let skippedDuplicate = 0;
    let quarantined = 0;

    for (let i = 0; i < records.length; i += STELLAR_BATCH_SIZE) {
      const batch = records.slice(i, i + STELLAR_BATCH_SIZE);
      const anchored: Array<{ record: ParsedRecord; cid: string; idx: number; fingerprint: string }> = [];

      for (let j = 0; j < batch.length; j++) {
        const rec = batch[j];
        const globalIdx = i + j;

        // ── Deduplication check ──────────────────────────────────────────────
        const fingerprint = this.deduplication.computeFingerprint(rec);
        const dedupResult = await this.deduplication.check(fingerprint);

        if (dedupResult.isDuplicate) {
          if (quarantineMode) {
            await this.deduplication.quarantine(fingerprint, jobId, rec.rawPayload);
            quarantined++;
          } else {
            skippedDuplicate++;
          }
          continue;
        }
        // ────────────────────────────────────────────────────────────────────

        try {
          if (!dryRun) {
            const cid = await this.ipfs.upload(Buffer.from(rec.rawPayload));
            anchored.push({ record: rec, cid, idx: globalIdx, fingerprint });
          } else {
            succeeded++;
          }
        } catch (err: any) {
          failed++;
          await this._logError(jobId, globalIdx, rec.rawPayload, err);
        }
      }

      if (!dryRun && anchored.length > 0) {
        let stellarTxHash: string | null = null;
        try {
          stellarTxHash = await this.stellar.anchorCid(
            anchored[0].record.patientId,
            anchored.map((a) => a.cid).join(','),
          );
        } catch (err: any) {
          for (const a of anchored) {
            failed++;
            await this._logError(jobId, a.idx, a.record.rawPayload, err);
          }
          await this.jobRepo.update(jobId, {
            processed: i + batch.length,
            succeeded,
            failed,
            skippedDuplicate,
            quarantined,
          });
          continue;
        }

        for (const a of anchored) {
          try {
            await this.recordRepo.save(
              this.recordRepo.create({
                patientId: a.record.patientId,
                cid: a.cid,
                stellarTxHash: stellarTxHash ?? undefined,
                recordType: a.record.recordType,
                description: a.record.description,
              }),
            );
            await this.deduplication.register(a.fingerprint, jobId, a.record.rawPayload);
            succeeded++;
          } catch (err: any) {
            failed++;
            await this._logError(jobId, a.idx, a.record.rawPayload, err);
          }
        }
      }

      await this.jobRepo.update(jobId, {
        processed: i + batch.length,
        succeeded,
        failed,
        skippedDuplicate,
        quarantined,
      });

      await job.updateProgress(Math.round(((i + batch.length) / records.length) * 100));
    }

    await this.jobRepo.update(jobId, {
      status: ImportJobStatus.COMPLETED,
      succeeded,
      failed,
      skippedDuplicate,
      quarantined,
    });

    await this.tempStorage.deleteFile(tempFilePath);
    this.logger.log(
      `Completed EHR import job ${jobId}: created=${succeeded} skipped_duplicate=${skippedDuplicate} quarantined=${quarantined} failed=${failed}`,
    );
  }

  private async _parse(
    format: ImportFormat,
    buffer: Buffer,
    columnMap?: CsvColumnMap,
  ): Promise<ParsedRecord[]> {
    const text = buffer.toString('utf-8');
    switch (format) {
      case ImportFormat.HL7:
        return this.hl7Parser.parse(text);
      case ImportFormat.CCD:
        return this.ccdParser.parse(text);
      case ImportFormat.CSV:
        return this.csvParser.parse(text, columnMap);
      default:
        throw new BadRequestException(`Unsupported format: ${format}`);
    }
  }

  private async _logError(
    jobId: string,
    rowIndex: number,
    sourceRow: string,
    err: Error,
  ): Promise<void> {
    await this.errorRepo.save(
      this.errorRepo.create({
        jobId,
        rowIndex,
        sourceRow: sourceRow.slice(0, 2000),
        errorMessage: err.message,
        stack: err.stack?.slice(0, 2000) ?? null,
      }),
    );
  }
}