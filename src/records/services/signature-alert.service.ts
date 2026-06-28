import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SignatureStatus } from './digital-signature.service';
import { AuditLogService } from '../../common/services/audit-log.service';

export interface SignatureAlertPayload {
  attachmentId: string;
  recordId: string;
  userId: string;
  status: SignatureStatus;
  algorithm?: string;
  metadata?: Record<string, any>;
}

const SIGNATURE_ALERT_EVENT = 'document.signature.invalid';

@Injectable()
export class SignatureAlertService {
  private readonly logger = new Logger(SignatureAlertService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Alert the records department when an invalid signature is detected.
   *
   * This method:
   * 1. Emits an application-level event for real-time alerting
   * 2. Creates an audit log entry for compliance tracking
   * 3. Logs a warning for operational monitoring
   *
   * @param payload - Alert details including attachment, record, and verification info
   */
  async alertInvalidSignature(payload: SignatureAlertPayload): Promise<void> {
    this.logger.warn(
      `Signature verification failed for attachment ${payload.attachmentId} on record ${payload.recordId}`,
    );

    // 1. Emit real-time event for alerting system
    this.eventEmitter.emit(SIGNATURE_ALERT_EVENT, {
      ...payload,
      timestamp: new Date().toISOString(),
      severity: 'HIGH',
    });

    // 2. Audit log for HIPAA/regulatory compliance
    await this.auditLogService.create({
      operation: 'SIGNATURE_VERIFICATION_FAILED',
      entityType: 'RecordAttachment',
      entityId: payload.attachmentId,
      userId: payload.userId,
      status: 'failed',
      errorMessage: `Digital signature validation failed: ${payload.status}`,
      changes: {
        recordId: payload.recordId,
        signatureStatus: payload.status,
        algorithm: payload.algorithm,
        metadata: payload.metadata,
      },
    });
  }

  /**
   * Log a successful signature verification (for audit trail)
   */
  async logValidSignature(payload: Omit<SignatureAlertPayload, 'status'> & { status: SignatureStatus.VALID }): Promise<void> {
    await this.auditLogService.create({
      operation: 'SIGNATURE_VERIFICATION_SUCCESS',
      entityType: 'RecordAttachment',
      entityId: payload.attachmentId,
      userId: payload.userId,
      status: 'success',
      changes: {
        recordId: payload.recordId,
        signatureStatus: payload.status,
        algorithm: payload.algorithm,
        signedAt: payload.metadata?.signedAt,
      },
    });
  }

  /**
   * Handle a signature alert event — to be consumed by notification modules
   */
  handleAlertEvent(event: SignatureAlertPayload & { timestamp: string; severity: string }): void {
    this.logger.error(
      `[SIGNATURE ALERT] ${event.severity}: Attachment ${event.attachmentId} ` +
        `on record ${event.recordId} has ${event.status} signature. ` +
        `Triggered by user ${event.userId} at ${event.timestamp}`,
    );
  }
}
