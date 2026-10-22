import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import * as QRCode from 'qrcode';
import { EmergencyMedicalInfo } from '../entities/emergency-medical-info.entity';
import { EmergencyMedicalInfoService } from './emergency-medical-info.service';

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
  metadata: { lastUpdatedBy: string | null };
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
    @Inject(forwardRef(() => EmergencyMedicalInfoService))
    private readonly service: EmergencyMedicalInfoService,
  ) {
    const configuredSecret = this.config.get<string>('QR_HMAC_SECRET');
    if (!configuredSecret && process.env.NODE_ENV !== 'development') {
      throw new Error('QR_HMAC_SECRET must be configured in non-development environments');
    }
    this.hmacSecret = configuredSecret ?? 'development-only-qr-secret';
    this.appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
  }

  /** Opt a patient in (or rotate their token if overdue) and return the signed payload URL */
  async generateOptIn(patientId: string, callerId?: string): Promise<{ verifyUrl: string; issuedAt: string }> {
    this.assertOwnership(patientId, callerId);
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
  async revokeOptIn(patientId: string, callerId?: string): Promise<void> {
    this.assertOwnership(patientId, callerId);
    const record = await this.findRecord(patientId);
    record.qrOptIn = false;
    record.qrToken = null;
    record.qrIssuedAt = null;
    await this.repo.save(record);
  }

  /** Return a PNG buffer of the QR code for download */
  async downloadPng(patientId: string, callerId?: string): Promise<Buffer> {
    this.assertOwnership(patientId, callerId);
    const record = await this.findRecord(patientId);

    if (!record.qrOptIn || !record.qrToken) {
      throw new BadRequestException('Patient has not opted in to emergency QR');
    }

    this.enforceRotation(record);

    const payload = await this.buildPayload(record);
    const content = JSON.stringify(payload);
    return QRCode.toBuffer(content, { type: 'png', errorCorrectionLevel: 'M' });
  }

  /** Public verify endpoint — validates signature and returns decoded data */
  async verify(token: string): Promise<QrPayload['data'] & { patientId: string; metadata: { lastUpdatedBy: string | null } }> {
    const input = token?.trim();

    if (input.startsWith('{')) {
      let payload: Partial<QrPayload>;
      try {
        payload = JSON.parse(input) as Partial<QrPayload>;
      } catch {
        throw new UnauthorizedException('QR signature invalid');
      }

      if (!payload.token || !payload.sig || !payload.data || !payload.metadata) {
        throw new UnauthorizedException('QR signature invalid');
      }

      const unsigned = {
        token: payload.token,
        patientId: payload.patientId,
        issuedAt: payload.issuedAt,
        data: payload.data,
        metadata: payload.metadata,
      };
      const expected = this.sign(unsigned);
      const actual = Buffer.from(payload.sig, 'hex');
      const expectedBuffer = Buffer.from(expected, 'hex');

      if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) {
        throw new UnauthorizedException('QR signature invalid');
      }

      return { patientId: payload.patientId!, ...payload.data, metadata: payload.metadata };
    }

    const record = await this.repo.findOne({ where: { qrToken: input } });
    if (!record || !record.qrOptIn) {
      throw new NotFoundException('QR code not found or patient has opted out');
    }

    this.enforceRotation(record);

    const payload = await this.buildPayload(record);
    return { patientId: record.patientId, ...payload.data, metadata: payload.metadata };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /**
   * Ensure the authenticated caller is allowed to act on the given patient's
   * emergency QR code. Without this check any authenticated user could rotate,
   * revoke, or download another patient's emergency QR (life-safety impact).
   */
  private assertOwnership(patientId: string, callerId?: string): void {
    if (!callerId || callerId !== patientId) {
      throw new ForbiddenException(
        'You are not authorized to manage this patient\'s emergency QR code',
      );
    }
  }

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

  private async buildPayload(record: EmergencyMedicalInfo): Promise<QrPayload> {
    const lastUpdatedBy = await this.service.getLastUpdater(record.id);
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
      metadata: { lastUpdatedBy },
    };
    return { ...unsigned, sig: this.sign(unsigned) };
  }

  private sign(obj: object): string {
    return createHmac('sha256', this.hmacSecret)
      .update(JSON.stringify(obj))
      .digest('hex');
  }
}
