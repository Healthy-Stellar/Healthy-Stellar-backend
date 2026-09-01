import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Record } from '../records/entities/record.entity';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AuditLogEntity } from '../common/audit/audit-log.entity';

/** Data categories subject to retention policies */
export type RetentionCategory = 'medical_records' | 'audit_logs' | 'billing';

/** What to do when the retention period elapses */
export type RetentionAction = 'anonymize' | 'soft_delete';

export interface CategoryPolicy {
  /** Retention period in years */
  retentionYears: number;
  action: RetentionAction;
}

export interface TenantRetentionPolicy {
  tenantId: string;
  categories: Partial<Record<RetentionCategory, CategoryPolicy>>;
}

export interface RetentionRunResult {
  processed: number;
  errors: number;
  dryRun: boolean;
  details: Array<{ id: string; category: RetentionCategory; action: RetentionAction }>;
}

/** Default global policy (used when no tenant-specific policy exists) */
const DEFAULT_POLICIES: Record<RetentionCategory, CategoryPolicy> = {
  medical_records: { retentionYears: 7, action: 'anonymize' },
  audit_logs: { retentionYears: 7, action: 'soft_delete' },
  billing: { retentionYears: 7, action: 'soft_delete' },
};

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  /** In-memory tenant policy overrides. In production these would be loaded from TenantConfig. */
  private readonly tenantPolicies = new Map<string, TenantRetentionPolicy>();

  constructor(
    @InjectRepository(Record)
    private readonly recordRepo: Repository<Record>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) {}

  /** Register or update a per-tenant retention policy. */
  setTenantPolicy(policy: TenantRetentionPolicy): void {
    this.tenantPolicies.set(policy.tenantId, policy);
  }

  /** Retrieve the effective policy for a given tenant and category. */
  getEffectivePolicy(tenantId: string | null, category: RetentionCategory): CategoryPolicy {
    if (tenantId) {
      const tenantPolicy = this.tenantPolicies.get(tenantId);
      if (tenantPolicy?.categories[category]) {
        return tenantPolicy.categories[category]!;
      }
    }
    const globalYears = this.configService.get<number>('RECORD_RETENTION_YEARS', 7);
    return { ...DEFAULT_POLICIES[category], retentionYears: globalYears };
  }

  /** Compute cutoff date for a policy. */
  getCutoff(policy: CategoryPolicy): Date {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - policy.retentionYears);
    return cutoff;
  }

  /**
   * Legacy helper kept for backward compatibility.
   * Returns the global medical-records cutoff date.
   */
  getRetentionCutoff(): Date {
    const years = this.configService.get<number>('RECORD_RETENTION_YEARS', 7);
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);
    return cutoff;
  }

  /**
   * Applies retention policies across all configured tenants plus the global
   * default. This method is called by RetentionEnforcementJob (which owns the
   * nightly cron schedule). It can also be invoked directly for ad-hoc runs or
   * in tests.
   *
   * NOTE: Do NOT add a @Cron decorator here. RetentionEnforcementJob is the
   * single scheduled entry-point for all nightly enforcement. Adding a second
   * cron here would cause both jobs to run concurrently on the same tables with
   * conflicting actions (anonymize/soft-delete vs. archive-then-hard-delete).
   */
  async enforceRetentionPolicy(dryRun = false): Promise<RetentionRunResult> {
    this.logger.log(
      `DataRetentionService: starting nightly retention run (dryRun=${dryRun})`,
    );

    const result: RetentionRunResult = {
      processed: 0,
      errors: 0,
      dryRun,
      details: [],
    };

    // Process medical records (global + per-tenant)
    await this.processMedicalRecords(dryRun, result);

    // Process audit logs (global only — tenant-level audit log repos not yet wired)
    await this.processAuditLogs(dryRun, result);

    this.logger.log(
      `DataRetentionService: completed — processed=${result.processed}, errors=${result.errors}, dryRun=${dryRun}`,
    );

    return result;
  }

  private async processMedicalRecords(
    dryRun: boolean,
    result: RetentionRunResult,
  ): Promise<void> {
    const category: RetentionCategory = 'medical_records';
    // Collect all distinct tenant IDs from registered policies + a "null" pass for global
    const tenantIds = new Set<string | null>([null, ...this.tenantPolicies.keys()]);

    for (const tenantId of tenantIds) {
      const policy = this.getEffectivePolicy(tenantId, category);
      const cutoff = this.getCutoff(policy);

      if (tenantId) {
        // The Record entity does not yet carry a tenantId column, so we cannot
        // issue an isolated per-tenant query.  Skipping the DB pass prevents
        // double-processing the same global rows under every registered tenant
        // override.  When a tenantId column is added, replace this guard with a
        // { tenantId } filter in whereClause and remove the continue.
        this.logger.warn(
          `DataRetentionService: skipping per-tenant DB pass for tenant=${tenantId} ` +
            `(Record entity has no tenantId column; override is registered but cannot be ` +
            `applied at the row level until the column is added)`,
        );
        continue;
      }

      const whereClause: any = { createdAt: LessThan(cutoff) };
      const expired = await this.recordRepo.find({ where: whereClause });

      for (const record of expired) {
        try {
          if (!dryRun) {
            if (policy.action === 'anonymize') {
              record.patientId = `ANONYMIZED_${record.id}`;
              record.cid = '';
              await this.recordRepo.save(record);
            } else {
              await this.recordRepo.softDelete(record.id);
            }

            await this.auditLogService.log({
              action: 'DATA_RETENTION_PURGED',
              entity: 'Record',
              entityId: record.id,
              details: { category, policy, cutoffDate: cutoff },
              severity: 'LOW',
            });
          }

          result.processed++;
          result.details.push({ id: record.id, category, action: policy.action });
        } catch (err) {
          result.errors++;
          this.logger.error(
            `DataRetentionService: error processing record ${record.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  private async processAuditLogs(
    dryRun: boolean,
    result: RetentionRunResult,
  ): Promise<void> {
    const category: RetentionCategory = 'audit_logs';
    const policy = this.getEffectivePolicy(null, category);
    const cutoff = this.getCutoff(policy);

    const expired = await this.auditLogRepo.find({
      where: { createdAt: LessThan(cutoff) },
    });

    for (const log of expired) {
      try {
        if (!dryRun) {
          await this.auditLogService.log({
            action: 'DATA_RETENTION_PURGED',
            entity: 'AuditLog',
            entityId: log.id,
            details: { category, policy, cutoffDate: cutoff },
            severity: 'LOW',
          });

          await this.auditLogRepo.softDelete(log.id);
        }

        result.processed++;
        result.details.push({ id: log.id, category, action: policy.action });
      } catch (err) {
        result.errors++;
        this.logger.error(
          `DataRetentionService: error processing audit log ${log.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
