import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { EmergencyMedicalInfo } from '../entities/emergency-medical-info.entity';

/** Payload embedded in every QR code */
export interface QrPayload {
  token: string;
  patientId: string;
  issuedAt: string; // ISO-8601
  data: {
    bloodType: string;
    allergies: string[];
    criticalMedications: string[];
    emergencyContact: { name: string; relationship: string; phone: string } | null;
    dnrStatus: boolean;
  };
  sig: string; // HMAC-SHA256 hex
}

const QR_ROTATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable()
export class EmergencyQrService {
  private readonly hmacSecret: string;
  private readonly appUrl: string;

  constructor(
    @InjectRepository(EmergencyMedicalInfo)
    private readonly repo: Repository<EmergencyMedicalInfo>,
    private readonly config: ConfigService,
  ) {
    this.hmacSecret = this.config.get<string>('QR_HMAC_SECRET', 'change-me-in-production');
    this.appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
  }

  /** Opt a patient in (or rotate their token if overdue) and return the signed payload URL */
  async generateOptIn(patientId: string): Promise<{ verifyUrl: string; issuedAt: string }> {
    const record = await this.findRecord(patientId);

    const now = new Date();
    const needsRotation =
      !record.qrToken ||
      !record.qrIssuedAt ||
      now.getTime() - record.qrIssuedAt.getTime() >= QR_ROTATION_MS;

    if (needsRotation) {
      record.qrToken = randomUUID();
      record.qrIssuedAt = now;
    }
    record.qrOptIn = true;
    await this.repo.save(record);

    return {
      verifyUrl: `${this.appUrl}/emergency-medical-info/qr/verify/${record.qrToken}`,
      issuedAt: record.qrIssuedAt!.toISOString(),
    };
  }

  /** Opt a patient out and invalidate their token */
  async revokeOptIn(patientId: string): Promise<void> {
    const record = await this.findRecord(patientId);
    record.qrOptIn = false;
    record.qrToken = null;
    record.qrIssuedAt = null;
    await this.repo.save(record);
  }

  /** Return a PNG buffer of the QR code for download */
  async downloadPng(patientId: string): Promise<Buffer> {
    const record = await this.findRecord(patientId);

    if (!record.qrOptIn || !record.qrToken) {
      throw new BadRequestException('Patient has not opted in to emergency QR');
    }

    this.enforceRotation(record);

    const payload = this.buildPayload(record);
    const content = JSON.stringify(payload);
    return QRCode.toBuffer(content, { type: 'png', errorCorrectionLevel: 'M' });
  }

  /** Public verify endpoint — validates signature and returns decoded data */
  async verify(token: string): Promise<QrPayload['data'] & { patientId: string }> {
    const record = await this.repo.findOne({ where: { qrToken: token } });
    if (!record || !record.qrOptIn) {
      throw new NotFoundException('QR code not found or patient has opted out');
    }

    this.enforceRotation(record);

    const payload = this.buildPayload(record);
    const { sig, ...unsigned } = payload;
    const expected = this.sign(unsigned);
    if (sig !== expected) {
      throw new UnauthorizedException('QR signature invalid');
    }

    return { patientId: record.patientId, ...payload.data };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async findRecord(patientId: string): Promise<EmergencyMedicalInfo> {
    const record = await this.repo.findOne({ where: { patientId } });
    if (!record) {
      throw new NotFoundException(`Emergency medical info not found for patient ${patientId}`);
    }
    return record;
  }

  private enforceRotation(record: EmergencyMedicalInfo): void {
    if (
      !record.qrIssuedAt ||
      Date.now() - record.qrIssuedAt.getTime() >= QR_ROTATION_MS
    ) {
      throw new BadRequestException(
        'QR code has expired (30-day rotation). Please generate a new one.',
      );
    }
  }

  private buildPayload(record: EmergencyMedicalInfo): QrPayload {
    const unsigned = {
      token: record.qrToken!,
      patientId: record.patientId,
      issuedAt: record.qrIssuedAt!.toISOString(),
      data: {
        bloodType: record.bloodType,
        allergies: record.allergies,
        criticalMedications: record.currentMedications,
        emergencyContact: record.emergencyContacts?.[0] ?? null,
        dnrStatus: record.dnrStatus,
      },
    };
    return { ...unsigned, sig: this.sign(unsigned) };
  }

  private sign(obj: object): string {
    return createHmac('sha256', this.hmacSecret)
      .update(JSON.stringify(obj))
      .digest('hex');
  }
}
