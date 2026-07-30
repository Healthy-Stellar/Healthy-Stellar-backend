import {
  Injectable,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UserImportJob, ImportJobStatus } from '../entities/user-import-job.entity';
import { CsvUserRowDto, CsvRowValidationError, CsvImportJobPayload } from '../dto/bulk-import.dto';
import { QUEUE_NAMES } from '../../queues/queue.constants';

const MAX_ROWS = 1000;

@Injectable()
export class UserImportService {
  constructor(
    @InjectRepository(UserImportJob)
    private readonly jobRepo: Repository<UserImportJob>,
    @InjectQueue(QUEUE_NAMES.USER_CSV_IMPORT)
    private readonly importQueue: Queue,
  ) {}

  async importFromCsv(csvBuffer: Buffer, initiatedBy: string): Promise<UserImportJob> {
    const rows = this.parseCsv(csvBuffer);

    if (rows.length > MAX_ROWS) {
      throw new PayloadTooLargeException(
        `CSV exceeds maximum of ${MAX_ROWS} rows (found ${rows.length})`,
      );
    }

    const { validRows, rowErrors } = await this.validateRows(rows);

    if (rowErrors.length > 0) {
      throw new UnprocessableEntityException({
        message: 'CSV contains validation errors',
        errors: rowErrors,
      });
    }

    const job = await this.jobRepo.save(
      this.jobRepo.create({
        status: ImportJobStatus.PENDING,
        totalRows: validRows.length,
        initiatedBy,
      }),
    );

    const payload: CsvImportJobPayload = { jobId: job.id, rows: validRows, initiatedBy };
    await this.importQueue.add('process-csv-import', payload);

    return job;
  }

  async getJob(jobId: string): Promise<UserImportJob> {
    return this.jobRepo.findOneOrFail({ where: { id: jobId } });
  }

  private parseCsv(buffer: Buffer): Record<string, string>[] {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
  }

  private async validateRows(
    rawRows: Record<string, string>[],
  ): Promise<{ validRows: CsvUserRowDto[]; rowErrors: CsvRowValidationError[] }> {
    const validRows: CsvUserRowDto[] = [];
    const rowErrors: CsvRowValidationError[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const dto = plainToInstance(CsvUserRowDto, rawRows[i]);
      const errors = await validate(dto, { whitelist: true });

      if (errors.length > 0) {
        rowErrors.push({
          row: i + 2, // 1-based, +1 for header
          errors: errors.flatMap((e) => Object.values(e.constraints ?? {})),
        });
      } else {
        validRows.push(dto);
      }
    }

    return { validRows, rowErrors };
  }
}
