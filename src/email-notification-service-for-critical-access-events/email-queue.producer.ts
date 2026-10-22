// src/queue/email-queue.producer.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE } from './email-queue.module';

export enum EmailJobType {
  ACCESS_GRANTED = 'access-granted',
  ACCESS_REVOKED = 'access-revoked',
  RECORD_UPLOADED = 'record-uploaded',
  SUSPICIOUS_ACCESS = 'suspicious-access',
}

// Payloads contain only IDs — no PII/PHI stored in Redis
export interface AccessGrantedJobData {
  type: EmailJobType.ACCESS_GRANTED;
  patientId: string;
  granteeId: string;
  recordId: string;
}

export interface AccessRevokedJobData {
  type: EmailJobType.ACCESS_REVOKED;
  patientId: string;
  revokeeId: string;
  recordId: string;
}

export interface RecordUploadedJobData {
  type: EmailJobType.RECORD_UPLOADED;
  patientId: string;
  recordId: string;
  uploadedById?: string;
}

export interface SuspiciousAccessJobData {
  type: EmailJobType.SUSPICIOUS_ACCESS;
  patientId: string;
  /** Opaque reference to the audit-log row; consumer fetches full event details */
  accessEventId: string;
}

export type EmailJobData =
  | AccessGrantedJobData
  | AccessRevokedJobData
  | RecordUploadedJobData
  | SuspiciousAccessJobData;

@Injectable()
export class EmailQueueProducer {
  private readonly logger = new Logger(EmailQueueProducer.name);

  constructor(@InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue) {}

  async queueAccessGrantedEmail(
    patientId: string,
    granteeId: string,
    recordId: string,
  ): Promise<void> {
    const job = await this.emailQueue.add(
      EmailJobType.ACCESS_GRANTED,
      { type: EmailJobType.ACCESS_GRANTED, patientId, granteeId, recordId } satisfies AccessGrantedJobData,
      { priority: 1 },
    );
    this.logger.log(`Queued access-granted email job ${job.id} for patient ${patientId}`);
  }

  async queueAccessRevokedEmail(
    patientId: string,
    revokeeId: string,
    recordId: string,
  ): Promise<void> {
    const job = await this.emailQueue.add(
      EmailJobType.ACCESS_REVOKED,
      { type: EmailJobType.ACCESS_REVOKED, patientId, revokeeId, recordId } satisfies AccessRevokedJobData,
      { priority: 1 },
    );
    this.logger.log(`Queued access-revoked email job ${job.id} for patient ${patientId}`);
  }

  async queueRecordUploadedEmail(
    patientId: string,
    recordId: string,
    uploadedById?: string,
  ): Promise<void> {
    const job = await this.emailQueue.add(
      EmailJobType.RECORD_UPLOADED,
      { type: EmailJobType.RECORD_UPLOADED, patientId, recordId, uploadedById } satisfies RecordUploadedJobData,
      { priority: 2 },
    );
    this.logger.log(`Queued record-uploaded email job ${job.id} for patient ${patientId}`);
  }

  async queueSuspiciousAccessEmail(patientId: string, accessEventId: string): Promise<void> {
    const job = await this.emailQueue.add(
      EmailJobType.SUSPICIOUS_ACCESS,
      { type: EmailJobType.SUSPICIOUS_ACCESS, patientId, accessEventId } satisfies SuspiciousAccessJobData,
      { priority: 0 },
    );
    this.logger.log(`Queued suspicious-access email job ${job.id} for patient ${patientId}`);
  }
}
