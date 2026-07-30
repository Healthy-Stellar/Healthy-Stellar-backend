import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Record as MedicalRecord } from '../../records/entities/record.entity';
import { AuditLogEntity } from '../../common/audit/audit-log.entity';
import { EventStoreService } from '../../event-store/event-store.service';
import { RetentionBatchProcessed } from '../../event-store/domain-events';
import { ArchiveService } from '../services/archive.service';
import { RetentionPolicyRegistryService } from '../services/retention-policy-registry.service';
import {
  BatchOutcome,
  RetentionEntityType,
  RetentionPolicy,
  RetentionRecordRef,
  RetentionRunReport,
} from '../retention-policy.types';

/**
 * Entity types this job actively enforces against a wired repository.
 * `appointment_logs` and `session_tokens` policies are resolvable via
 * RetentionPolicyRegistryService (including tenant overrides) but are not
 * yet backed by a repository here — wiring a new entity type only requires
 * adding a branch to `fetchExpiredBatch`/`deleteBatch` below.
 */
const ENFORCED_ENTITY_TYPES: RetentionEntityType[] = ['medical_records', 'audit_logs'];

@Injectable()
export class RetentionEnforcementJob {
  private readonly logger = new Logger(RetentionEnforcementJob.name);

  constructor(
    @InjectRepository(MedicalRecord)
    private readonly recordRepo: Repository<MedicalRecord>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
    private readonly policyRegistry: RetentionPolicyRegistryService,
    private readonly archiveService: ArchiveService,
    private readonly eventStore: EventStoreService,
  ) {}

  /** Nightly scheduled enforcement run (archives + deletes expired records). */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runNightly(): Promise<RetentionRunReport> {
    return this.run(false);
  }

  /**
   * Dry-run report: identifies records that *would* be affected by the
   * current policies, without archiving, deleting, or emitting any
   * mutating events.
   */
  async runDryRun(): Promise<RetentionRunReport> {
    return this.run(true);
  }

  /**
   * Core enforcement loop. Iterates every enforced entity type across the
   * global policy plus every tenant with a registered override, batching
   * the expired rows and (unless dryRun) archiving + deleting each batch
   * before emitting an observability event for it.
   */
  async run(dryRun: boolean): Promise<RetentionRunReport> {
    const startedAt = new Date();
    this.logger.log(`RetentionEnforcementJob: starting run (dryRun=${dryRun})`);

    const report: RetentionRunReport = {
      dryRun,
      startedAt,
      finishedAt: startedAt,
      batches: [],
      totalRecords: 0,
      totalArchived: 0,
      totalDeleted: 0,
      errors: [],
    };

    for (const entityType of ENFORCED_ENTITY_TYPES) {
      const tenantIds: Array<string | null> = [null, ...this.policyRegistry.getOverriddenTenantIds()];

      for (const tenantId of tenantIds) {
        try {
          const outcome = await this.processEntityTypeForTenant(entityType, tenantId, dryRun);
          if (outcome) {
            report.batches.push(outcome);
            report.totalRecords += outcome.recordCount;
            report.totalArchived += outcome.archivedCount;
            report.totalDeleted += outcome.deletedCount;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          report.errors.push({ entityType, tenantId, message });
          this.logger.error(
            `RetentionEnforcementJob: error processing entityType=${entityType} tenant=${tenantId ?? 'global'}: ${message}`,
          );
        }
      }
    }

    report.finishedAt = new Date();
    this.logger.log(
      `RetentionEnforcementJob: finished run (dryRun=${dryRun}) — ` +
        `records=${report.totalRecords}, archived=${report.totalArchived}, deleted=${report.totalDeleted}, errors=${report.errors.length}`,
    );

    return report;
  }

  /**
   * Process a single (entityType, tenantId) pair: resolve the effective
   * policy, find expired rows, and process them in batches of policy.batchSize.
   * Returns undefined if there is nothing to report (no tenant-specific repo
   * wired, or — for the global pass — when records are scoped per tenant only).
   */
  private async processEntityTypeForTenant(
    entityType: RetentionEntityType,
    tenantId: string | null,
    dryRun: boolean,
  ): Promise<BatchOutcome | undefined> {
    const policy = this.policyRegistry.getEffectivePolicy(entityType, tenantId);
    const cutoff = this.policyRegistry.getCutoffDate(policy);
    const batchSize = policy.batchSize ?? 500;

    // Neither Record nor AuditLogEntity carries a tenantId column today, so
    // tenant-scoped passes are skipped to avoid double-processing the same
    // global rows under every registered tenant override.
    if (tenantId) {
      return undefined;
    }

    let recordCount = 0;
    let archivedCount = 0;
    let deletedCount = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await this.fetchExpiredBatch(entityType, cutoff, batchSize);
      if (batch.length === 0) break;

      recordCount += batch.length;

      if (!dryRun) {
        const archived = await this.archiveService.archiveBatch(entityType, policy.id, batch);
        archivedCount += archived;

        const deleted = await this.deleteBatch(entityType, batch.map((r) => r.id));
        deletedCount += deleted;

        await this.emitBatchEvent(policy, entityType, tenantId, batch.length, archived, deleted, dryRun, cutoff);
      }

      // In dry-run mode we still want to report what *would* happen, but we
      // must not loop forever re-fetching the same "expired" rows since
      // nothing was deleted. A single pass is sufficient for the report.
      if (dryRun) break;

      // If the batch was smaller than batchSize, there's nothing left to fetch.
      if (batch.length < batchSize) break;
    }

    if (dryRun && recordCount > 0) {
      // Dry-run emits no mutating event, but we still surface the report via
      // the returned BatchOutcome so callers (and tests) can assert on it.
      this.logger.log(
        `RetentionEnforcementJob: [dry-run] ${recordCount} ${entityType} record(s) would be archived+deleted under policy ${policy.id}`,
      );
    }

    if (recordCount === 0) {
      return undefined;
    }

    return {
      policyId: policy.id,
      entityType,
      tenantId,
      action: policy.action,
      recordCount,
      archivedCount,
      deletedCount,
      dryRun,
      cutoffDate: cutoff,
    };
  }

  private async fetchExpiredBatch(
    entityType: RetentionEntityType,
    cutoff: Date,
    batchSize: number,
  ): Promise<RetentionRecordRef[]> {
    switch (entityType) {
      case 'medical_records': {
        const rows = await this.recordRepo.find({
          where: { createdAt: LessThan(cutoff) },
          take: batchSize,
          order: { createdAt: 'ASC' },
        });
        return rows.map((row) => ({
          id: row.id,
          tenantId: null,
          createdAt: row.createdAt,
          payload: { ...row },
        }));
      }
      case 'audit_logs': {
        const rows = await this.auditLogRepo.find({
          where: { createdAt: LessThan(cutoff) },
          take: batchSize,
          order: { createdAt: 'ASC' },
        });
        return rows.map((row) => ({
          id: row.id,
          tenantId: null,
          createdAt: row.createdAt,
          payload: { ...row },
        }));
      }
      default:
        return [];
    }
  }

  private async deleteBatch(entityType: RetentionEntityType, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    switch (entityType) {
      case 'medical_records': {
        const result = await this.recordRepo.delete(ids);
        return result.affected ?? ids.length;
      }
      case 'audit_logs': {
        const result = await this.auditLogRepo.delete(ids);
        return result.affected ?? ids.length;
      }
      default:
        return 0;
    }
  }

  /** Emit one observability event per processed batch via the event store. */
  private async emitBatchEvent(
    policy: RetentionPolicy,
    entityType: RetentionEntityType,
    tenantId: string | null,
    recordCount: number,
    archivedCount: number,
    deletedCount: number,
    dryRun: boolean,
    cutoff: Date,
  ): Promise<void> {
    const aggregateId = `retention-${policy.id}-${tenantId ?? 'global'}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const event = new RetentionBatchProcessed(aggregateId, {
      policyId: policy.id,
      entityType,
      tenantId,
      action: policy.action,
      recordCount,
      archivedCount,
      deletedCount,
      dryRun,
      cutoffDate: cutoff.toISOString(),
    });

    // Each batch event starts a brand new aggregate stream (expectedVersion 0)
    // so concurrent batches never collide on optimistic-concurrency checks.
    await this.eventStore.append(aggregateId, [event], 0);
  }
}
