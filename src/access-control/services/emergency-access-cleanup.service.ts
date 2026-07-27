import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { SorobanQueueService } from './soroban-queue.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AccessGrant } from '../entities/access-grant.entity';

const MAX_REVOKE_RETRIES = 3;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

@Injectable()
export class EmergencyAccessCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmergencyAccessCleanupService.name);
  private cleanupInterval: NodeJS.Timeout | null = null;

  /** Grantees whose Soroban revocation failed after max retries — blocked at API guard level. */
  readonly lockedGranteeIds = new Set<string>();

  constructor(
    private readonly accessControlService: AccessControlService,
    private readonly sorobanQueueService: SorobanQueueService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.cleanupInterval = setInterval(() => this.runCleanup(), CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async runCleanup(): Promise<void> {
    let expiringGrants: AccessGrant[];
    try {
      expiringGrants = await this.accessControlService.expireEmergencyGrants();
    } catch (error) {
      this.logger.error('Failed to fetch expiring grants', error instanceof Error ? error.stack : undefined);
      return;
    }

    if (expiringGrants.length === 0) return;

    this.logger.log(`Processing ${expiringGrants.length} expiring emergency grants`);

    await Promise.all(expiringGrants.map((grant) => this.revokeWithRetry(grant)));
  }

  private async revokeWithRetry(grant: AccessGrant, attempt = 1): Promise<void> {
    try {
      const txHash = await this.sorobanQueueService.dispatchRevoke(grant);
      await this.accessControlService.finalizeExpiredGrant(grant.id, txHash);
      this.logger.log(`Grant ${grant.id} revoked on-chain (tx: ${txHash})`);
    } catch (error) {
      if (attempt < MAX_REVOKE_RETRIES) {
        this.logger.warn(`Revoke attempt ${attempt} failed for grant ${grant.id}, retrying…`);
        await this.revokeWithRetry(grant, attempt + 1);
      } else {
        await this.handleRevocationFailure(grant, error);
      }
    }
  }

  private async handleRevocationFailure(grant: AccessGrant, error: unknown): Promise<void> {
    this.logger.error(
      `Soroban revocation failed after ${MAX_REVOKE_RETRIES} attempts for grant ${grant.id} (grantee: ${grant.granteeId})`,
      error instanceof Error ? error.stack : undefined,
    );

    // Circuit-breaker: lock grantee at API guard level
    this.lockedGranteeIds.add(grant.granteeId);
    this.logger.warn(`Grantee ${grant.granteeId} locked at API guard level as failsafe`);

    // Escalate alert
    await this.notificationsService.sendPatientEmailNotification(
      grant.patientId,
      'ALERT: Emergency access revocation failed',
      `Emergency grant ${grant.id} for grantee ${grant.granteeId} could not be revoked on-chain after ${MAX_REVOKE_RETRIES} attempts. Access has been blocked at the API level pending manual intervention.`,
    );
  }
}
