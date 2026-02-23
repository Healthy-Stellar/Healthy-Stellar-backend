// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface Patient {
  id: string;
  email: string;
  name: string;
  unsubscribeToken?: string;
}

export interface Provider {
  id: string;
  name: string;
  email: string;
  specialty?: string;
}

export interface MedicalRecord {
  id: string;
  title: string;
  uploadedAt: Date;
  type?: string;
}

export interface SuspiciousAccessEvent {
  accessedAt: Date;
  ipAddress: string;
  location?: string;
  accessorName: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly isTestEnv: boolean;
  private readonly appUrl: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.isTestEnv = configService.get('NODE_ENV') === 'test';
    this.appUrl = configService.get('APP_URL', 'http://localhost:3000');
  }

  /**
   * Generates or returns existing unsubscribe token for patient
   */
  private generateUnsubscribeToken(patient: Patient): string {
    if (patient.unsubscribeToken) return patient.unsubscribeToken;
    return crypto
      .createHmac('sha256', this.configService.get('UNSUBSCRIBE_SECRET', 'secret'))
      .update(patient.id)
      .digest('hex');
  }

  private buildUnsubscribeUrl(patient: Patient): string {
    const token = this.generateUnsubscribeToken(patient);
    return `${this.appUrl}/notifications/unsubscribe?token=${token}&patientId=${patient.id}`;
  }

  async sendAccessGrantedEmail(
    patient: Patient,
    grantee: Provider,
    record: MedicalRecord,
  ): Promise<void> {
    const template = 'access-granted/access-granted';
    const subject = `Access Granted: ${grantee.name} can now view your records`;

    if (this.isTestEnv) {
      this.logger.log(
        `[TEST] Would send '${subject}' to ${patient.email}`,
        { patient, grantee, record },
      );
      return;
    }

    await this.mailerService.sendMail({
      to: patient.email,
      subject,
      template,
      context: {
        patientName: patient.name,
        granteeName: grantee.name,
        granteeSpecialty: grantee.specialty,
        recordTitle: record.title,
        recordType: record.type,
        grantedAt: new Date().toLocaleDateString(),
        unsubscribeUrl: this.buildUnsubscribeUrl(patient),
        appUrl: this.appUrl,
      },
    });
  }

  async sendAccessRevokedEmail(
    patient: Patient,
    revokee: Provider,
    record: MedicalRecord,
  ): Promise<void> {
    const subject = `Access Revoked: ${revokee.name} no longer has access to your records`;

    if (this.isTestEnv) {
      this.logger.log(`[TEST] Would send '${subject}' to ${patient.email}`);
      return;
    }

    await this.mailerService.sendMail({
      to: patient.email,
      subject,
      template: 'access-revoked/access-revoked',
      context: {
        patientName: patient.name,
        granteeName: revokee.name,
        recordTitle: record.title,
        revokedAt: new Date().toLocaleDateString(),
        unsubscribeUrl: this.buildUnsubscribeUrl(patient),
        appUrl: this.appUrl,
      },
    });
  }

  async sendRecordUploadedEmail(
    patient: Patient,
    record: MedicalRecord,
    uploadedBy?: Provider,
  ): Promise<void> {
    const subject = `New Record Available: ${record.title}`;

    if (this.isTestEnv) {
      this.logger.log(`[TEST] Would send '${subject}' to ${patient.email}`);
      return;
    }

    await this.mailerService.sendMail({
      to: patient.email,
      subject,
      template: 'record-uploaded/record-uploaded',
      context: {
        patientName: patient.name,
        recordTitle: record.title,
        recordType: record.type,
        uploadedBy: uploadedBy?.name ?? 'Your care team',
        uploadedAt: record.uploadedAt.toLocaleDateString(),
        viewRecordUrl: `${this.appUrl}/records/${record.id}`,
        unsubscribeUrl: this.buildUnsubscribeUrl(patient),
        appUrl: this.appUrl,
      },
    });
  }

  async sendSuspiciousAccessEmail(
    patient: Patient,
    event: SuspiciousAccessEvent,
  ): Promise<void> {
    const subject = '⚠️ Suspicious Access Detected on Your Health Records';

    if (this.isTestEnv) {
      this.logger.log(`[TEST] Would send '${subject}' to ${patient.email}`);
      return;
    }

    await this.mailerService.sendMail({
      to: patient.email,
      subject,
      template: 'suspicious-access/suspicious-access',
      context: {
        patientName: patient.name,
        accessorName: event.accessorName,
        accessedAt: event.accessedAt.toLocaleString(),
        ipAddress: event.ipAddress,
        location: event.location ?? 'Unknown',
        reportUrl: `${this.appUrl}/security/report`,
        unsubscribeUrl: this.buildUnsubscribeUrl(patient),
        appUrl: this.appUrl,
      },
    });
  }
}
