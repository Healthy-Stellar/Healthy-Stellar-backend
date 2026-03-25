import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Record } from '../records/entities/record.entity';
import { AuditLogService } from '../common/audit/audit-log.service';

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @InjectRepository(Record)
    private readonly recordRepo: Repository<Record>,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) {}

  getRetentionCutoff(): Date {
    const years = this.configService.get<number>('RECORD_RETENTION_YEARS', 7);
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);
    return cutoff;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async enforceRetentionPolicy(): Promise<{ anonymized: number; errors: number }> {
    this.logger.log('DataRetentionService: starting nightly retention run');
    const cutoff = this.getRetentionCutoff();

    const expired = await this.recordRepo.find({
      where: { createdAt: LessThan(cutoff) },
    });

    if (expired.length === 0) {
      this.logger.log('DataRetentionService: no records past retention period');
      return { anonymized: 0, errors: 0 };
    }

    let anonymized = 0;
    const errors: string[] = [];

    for (const record of expired) {
      try {
        record.patientId = `ANONYMIZED_${record.id}`;
        record.cid = '';
        await this.recordRepo.save(record);

        await this.auditLogService.log({
          action: 'DATA_RETENTION_ANONYMIZED',
          entity: 'Record',
          entityId: record.id,
          details: {
            cutoffDate: cutoff,
            retentionYears: this.configService.get<number>('RECORD_RETENTION_YEARS', 7),
          },
          severity: 'LOW',
        });

        anonymized++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Record ${record.id}: ${msg}`);
      }
    }

    this.logger.log(
      `DataRetentionService: anonymized ${anonymized}/${expired.length}, errors: ${errors.length}`,
    );
    if (errors.length > 0) {
      this.logger.error(`DataRetentionService errors: ${errors.join(', ')}`);
    }

    return { anonymized, errors: errors.length };
  }
}
