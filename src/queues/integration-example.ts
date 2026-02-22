import { Injectable } from '@nestjs/common';
import { QueueService } from '../queues/queue.service';
import { JOB_TYPES } from '../queues/queue.constants';
import { v4 as uuidv4 } from 'uuid';

/**
 * Example integration of QueueService with Medical Records
 * This demonstrates how to dispatch Stellar transactions asynchronously
 */
@Injectable()
export class MedicalRecordsIntegrationExample {
  constructor(private readonly queueService: QueueService) {}

  /**
   * Create a medical record and anchor it to Stellar blockchain asynchronously
   */
  async createAndAnchorRecord(recordData: any, userId: string) {
    // 1. Save record to database (synchronous)
    const record = { id: '123', hash: 'record_hash', ...recordData };

    // 2. Dispatch blockchain anchoring as async job (non-blocking)
    const correlationId = uuidv4();
    await this.queueService.dispatchStellarTransaction({
      operationType: JOB_TYPES.ANCHOR_RECORD,
      params: { recordId: record.id, hash: record.hash },
      initiatedBy: userId,
      correlationId,
    });

    // 3. Return immediately with correlation ID for status tracking
    return {
      record,
      jobCorrelationId: correlationId,
      message: 'Record created. Blockchain anchoring in progress.',
    };
  }

  /**
   * Grant access to a medical record on Stellar blockchain
   */
  async grantRecordAccess(recordId: string, targetUserId: string, grantedBy: string) {
    const correlationId = uuidv4();
    
    await this.queueService.dispatchStellarTransaction({
      operationType: JOB_TYPES.GRANT_ACCESS,
      params: { recordId, targetUserId },
      initiatedBy: grantedBy,
      correlationId,
    });

    return {
      correlationId,
      message: 'Access grant request queued.',
    };
  }

  /**
   * Revoke access to a medical record on Stellar blockchain
   */
  async revokeRecordAccess(recordId: string, targetUserId: string, revokedBy: string) {
    const correlationId = uuidv4();
    
    await this.queueService.dispatchStellarTransaction({
      operationType: JOB_TYPES.REVOKE_ACCESS,
      params: { recordId, targetUserId },
      initiatedBy: revokedBy,
      correlationId,
    });

    return {
      correlationId,
      message: 'Access revocation request queued.',
    };
  }

  /**
   * Check the status of a blockchain operation
   */
  async checkOperationStatus(correlationId: string) {
    return this.queueService.getJobStatus(correlationId);
  }
}
