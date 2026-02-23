// src/queue/email-queue.producer.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE } from './email-queue.module';
import { Patient, Provider, MedicalRecord, SuspiciousAccessEvent } from '../mail/mail.service';

export enum EmailJobType {
  ACCESS_GRANTED = 'access-granted',
  ACCESS_REVOKED = 'access-revoked',
  RECORD_UPLOADED = 'record-uploaded',
  SUSPICIOUS_ACCESS = 'suspicious-access',
}

export interface AccessGrantedJobData {
  type: EmailJobType.ACCESS_GRANTED;
  patient: Patient;
  grantee: Provider;
  record: MedicalRecord;
}

export interface AccessRevokedJobData {
  type: EmailJobType.ACCESS_REVOKED;
  patient: Patient;
  revokee: Provider;
  record: MedicalRecord;
}

export interface RecordUploadedJobData {
  type: EmailJobType.RECORD_UPLOADED;
  patient: Patient;
  record: MedicalRecord;
  uploadedBy?: Provider;
}

export interface SuspiciousAccessJobData {
  type: EmailJobType.SUSPICIOUS_ACCESS;
  patient: Patient;
  event: SuspiciousAccessEvent;
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
    patient: Patient,
    grantee: Provider,
    record: MedicalRecord,
  ): Promise<void> {
    const job = await this.emailQueue.add(
      EmailJobType.ACCESS_GRANTED,
      { type: EmailJobType.ACCESS_GRANTED, patient, grantee, record } satisfies AccessGrantedJobData,
      { priority: 1 }, // High priority
    );
    this.logger.log(`Queued access-granted email job ${job.id} for patient ${patient.id}`);
  }

  async queueAccessRevokedEmail(
    patient: Patient,
    revokee: Provider,
    record: MedicalRecord,
  ): Promise<void> {
    const job = await this.emailQueue.add(
      EmailJobType.ACCESS_REVOKED,
      { type: EmailJobType.ACCESS_REVOKED, patient, revokee, record } satisfies AccessRevokedJobData,
      { priority: 1 },
    );
    this.logger.log(`Queued access-revoked email job ${job.id} for patient ${patient.id}`);
  }

  async queueRecordUploadedEmail(
    patient: Patient,
    record: MedicalRecord,
    uploadedBy?: Provider,
  ): Promise<void> {
    const job = await this.emailQueue.add(
      EmailJobType.RECORD_UPLOADED,
      { type: EmailJobType.RECORD_UPLOADED, patient, record, uploadedBy } satisfies RecordUploadedJobData,
      { priority: 2 },
    );
    this.logger.log(`Queued record-uploaded email job ${job.id} for patient ${patient.id}`);
  }

  async queueSuspiciousAccessEmail(
    patient: Patient,
    event: SuspiciousAccessEvent,
  ): Promise<void> {
    const job = await this.emailQueue.add(
      EmailJobType.SUSPICIOUS_ACCESS,
      { type: EmailJobType.SUSPICIOUS_ACCESS, patient, event } satisfies SuspiciousAccessJobData,
      { priority: 0 }, // Highest priority
    );
    this.logger.log(`Queued suspicious-access email job ${job.id} for patient ${patient.id}`);
  }
}
