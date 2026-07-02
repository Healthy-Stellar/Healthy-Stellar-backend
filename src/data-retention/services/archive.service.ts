import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArchivedRecordEntity } from '../entities/archived-record.entity';
import { RetentionEntityType, RetentionRecordRef } from '../retention-policy.types';

/**
 * Minimal "cold storage" archival mechanism, backed by a DB-local table
 * (see ArchivedRecordEntity). Records are written here before being
 * deleted from their primary table by the retention enforcement job.
 */
@Injectable()
export class ArchiveService {
  private readonly logger = new Logger(ArchiveService.name);

  constructor(
    @InjectRepository(ArchivedRecordEntity)
    private readonly archiveRepo: Repository<ArchivedRecordEntity>,
  ) {}

  /**
   * Persist a batch of records to cold storage. Returns the number of rows
   * successfully archived. Never called in dry-run mode.
   */
  async archiveBatch(
    entityType: RetentionEntityType,
    policyId: string,
    records: RetentionRecordRef[],
  ): Promise<number> {
    if (records.length === 0) return 0;

    const rows = records.map((record) =>
      this.archiveRepo.create({
        entityType,
        originalId: record.id,
        tenantId: record.tenantId,
        policyId,
        payload: record.payload,
        originalCreatedAt: record.createdAt,
      }),
    );

    await this.archiveRepo.save(rows);

    this.logger.log(
      `ArchiveService: archived ${rows.length} ${entityType} record(s) under policy ${policyId}`,
    );

    return rows.length;
  }
}
