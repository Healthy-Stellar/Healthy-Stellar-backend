// src/records/records.service.ts — EXAMPLE USAGE
// Shows how to dispatch email notifications after business actions
// without blocking the request cycle.

import { Injectable } from '@nestjs/common';
import { EmailQueueProducer } from '../queue/email-queue.producer';
import { Patient, Provider, MedicalRecord } from '../mail/mail.service';

@Injectable()
export class RecordsService {
  constructor(private readonly emailQueue: EmailQueueProducer) {}

  async grantAccess(patient: Patient, provider: Provider, record: MedicalRecord) {
    // 1. Your business logic (DB writes, audit logs, etc.)
    // await this.recordsRepository.grantAccess(patient.id, provider.id, record.id);

    // 2. Fire-and-forget email — does NOT await the actual send
    //    BullMQ picks it up asynchronously with 3 retries + exponential backoff
    await this.emailQueue.queueAccessGrantedEmail(patient, provider, record);

    return { success: true };
  }

  async revokeAccess(patient: Patient, provider: Provider, record: MedicalRecord) {
    // await this.recordsRepository.revokeAccess(patient.id, provider.id, record.id);
    await this.emailQueue.queueAccessRevokedEmail(patient, provider, record);
    return { success: true };
  }

  async uploadRecord(patient: Patient, record: MedicalRecord, uploadedBy?: Provider) {
    // await this.recordsRepository.create(record);
    await this.emailQueue.queueRecordUploadedEmail(patient, record, uploadedBy);
    return { success: true };
  }

  async flagSuspiciousAccess(patient: Patient, ip: string, accessorName: string) {
    await this.emailQueue.queueSuspiciousAccessEmail(patient, {
      accessedAt: new Date(),
      ipAddress: ip,
      location: 'Unknown',
      accessorName,
    });
  }
}
