import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ExportConsentMapping, ExportBatchStatus } from '../entities/export-consent-mapping.entity';
import { AccessGrant, GrantStatus } from '../../access-control/entities/access-grant.entity';
import { AuditLogService } from '../../common/services/audit-log.service';

@Injectable()
export class ConsentRevocationService {
  private readonly logger = new Logger(ConsentRevocationService.name);

  constructor(
    @InjectRepository(ExportConsentMapping)
    private readonly mappingRepo: Repository<ExportConsentMapping>,
    @InjectRepository(AccessGrant)
    private readonly grantRepo: Repository<AccessGrant>,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async trackExportBatch(
    exportId: string,
    patientIds: string[],
    tenantId: string,
    researchRecipientId: string,
  ): Promise<void> {
    if (patientIds.length === 0) return;

    const mappings = patientIds.map((patientId) =>
      this.mappingRepo.create({
        exportId,
        patientId,
        tenantId,
        researchRecipientId,
        status: ExportBatchStatus.ACTIVE,
      }),
    );
    await this.mappingRepo.save(mappings);
    this.logger.log(`Tracked ${mappings.length} consent mappings for export ${exportId}`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredConsents(): Promise<void> {
    this.logger.log('Running consent expiry check...');
    const now = new Date();

    const expiredGrants = await this.grantRepo.find({
      where: { expiresAt: LessThanOrEqual(now), status: GrantStatus.ACTIVE },
    });

    for (const grant of expiredGrants) {
      // patientId, not granteeId. The grantee is whoever was given access (a
      // researcher); the batches that must be flagged are the ones carrying the
      // patient's data.
      await this.flagExportBatchesForPatient(grant.patientId, 'consent_expired', 'system');
      grant.status = GrantStatus.REVOKED;
      await this.grantRepo.save(grant);
    }

    if (expiredGrants.length > 0) {
      this.logger.warn(
        `Consent expiry check complete: flagged exports for ${expiredGrants.length} expired grants`,
      );
    }
  }

  async revokePatientConsent(
    patientId: string,
    revokedBy: string,
    reason = 'patient_request',
  ): Promise<number> {
    return this.flagExportBatchesForPatient(patientId, reason, revokedBy);
  }

  async getFlaggedBatches(tenantId: string): Promise<ExportConsentMapping[]> {
    return this.mappingRepo.find({
      where: { tenantId, status: ExportBatchStatus.FLAGGED },
      order: { flaggedAt: 'DESC' },
    });
  }

  private async flagExportBatchesForPatient(
    patientId: string,
    reason: string,
    actorId: string,
  ): Promise<number> {
    const affected = await this.mappingRepo.find({
      where: { patientId, status: ExportBatchStatus.ACTIVE },
    });

    if (affected.length === 0) return 0;

    const now = new Date();
    for (const mapping of affected) {
      mapping.status = ExportBatchStatus.FLAGGED;
      mapping.flaggedAt = now;
      mapping.flagReason = reason;
    }
    await this.mappingRepo.save(affected);

    const exportIds = [...new Set(affected.map((m) => m.exportId))];

    for (const exportId of exportIds) {
      this.eventEmitter.emit('research.export.revoked', {
        exportId,
        patientId,
        reason,
        flaggedAt: now.toISOString(),
      });

      await this.auditLogService.create({
        operation: 'CONSENT_REVOCATION_FLAGGED',
        entityType: 'ExportConsentMapping',
        entityId: exportId,
        userId: actorId,
        changes: { patientId, reason, status: ExportBatchStatus.FLAGGED },
      });
    }

    this.logger.warn(
      `Flagged ${affected.length} mappings across ${exportIds.length} export(s) for patient ${patientId} (reason: ${reason})`,
    );

    return affected.length;
  }
}
