import { Injectable, Logger } from '@nestjs/common';
import { AccessGrant } from '../entities/access-grant.entity';

export interface SorobanGrantDispatchPayload {
  grantId: string;
  patientId: string;
  granteeId: string;
  recordIds: string[];
  action: 'grant' | 'revoke';
}

@Injectable()
export class SorobanQueueService {
  private readonly logger = new Logger(SorobanQueueService.name);

  async dispatchGrantOrRevoke(payload: SorobanGrantDispatchPayload): Promise<string> {
    const transactionHash = this.buildDeterministicMockHash(payload);
    this.logger.log(`Queued Soroban ${payload.action} tx for grant ${payload.grantId}: ${transactionHash}`);

    return Promise.resolve(transactionHash);
  }

  buildMockHash(payload: SorobanGrantDispatchPayload): string {
    return this.buildDeterministicMockHash(payload);
  }

  private buildDeterministicMockHash(payload: SorobanGrantDispatchPayload): string {
    const normalized = `${payload.action}:${payload.grantId}:${payload.patientId}:${payload.granteeId}:${payload.recordIds.join(',')}`;
    const encoded = Buffer.from(normalized).toString('base64url');
    return `0x${encoded}`;
  }

  async dispatchGrant(grant: AccessGrant): Promise<string> {
    return this.dispatchGrantOrRevoke({
      grantId: grant.id,
      patientId: grant.patientId,
      granteeId: grant.granteeId,
      recordIds: grant.recordIds,
      action: 'grant',
    });
  }

  async dispatchRevoke(grant: AccessGrant): Promise<string> {
    return this.dispatchGrantOrRevoke({
      grantId: grant.id,
      patientId: grant.patientId,
      granteeId: grant.granteeId,
      recordIds: grant.recordIds,
      action: 'revoke',
    });
  }
}
