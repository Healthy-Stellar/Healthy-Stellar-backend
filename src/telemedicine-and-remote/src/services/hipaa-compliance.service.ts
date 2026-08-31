import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import * as crypto from 'crypto';
import { HipaaAuditLogEntity } from '../entity/hipaa-audit-log.entity';
import { PatientConsentEntity } from '../entity/patient-consent.entity';

/** Envelope layout for encrypted PHI: salt | iv | tag | ciphertext, base64. */
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

export interface HipaaAuditLog {
  resourceType: string;
  resourceId: string;
  action: string;
  userId: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface PatientConsent {
  patientId: string;
  consentType: string;
  consentGiven: boolean;
  consentDate: Date;
  expirationDate?: Date;
}

@Injectable()
export class HipaaComplianceService {
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(HipaaAuditLogEntity)
    private readonly auditLogRepository: Repository<HipaaAuditLogEntity>,
    @InjectRepository(PatientConsentEntity)
    private readonly consentRepository: Repository<PatientConsentEntity>,
  ) {
    // Refusing to boot without a key is the point. The previous default,
    // 'default-key-change-in-production', was published in this repository, so
    // a deployment that forgot the variable encrypted PHI under a key any
    // reader of the source already had — and did so silently, which is the
    // part that made it dangerous rather than merely wrong.
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error(
        'ENCRYPTION_KEY must be set: HipaaComplianceService will not start without it',
      );
    }
    this.encryptionKey = key;
  }

  /**
   * Encrypts PHI under a key derived freshly for this record.
   *
   * The salt is random per call rather than the literal string 'salt' it used
   * to be. A constant salt makes scrypt's work factor a one-time cost for an
   * attacker: derive the key once and every record in every deployment of this
   * service opens. Sixteen random bytes stored beside the ciphertext restores
   * the property the KDF is there for.
   *
   * AES-256-GCM replaces AES-256-CBC so the ciphertext carries an
   * authentication tag. Under CBC a tampered record decrypted to garbage and
   * `JSON.parse` threw somewhere far away; now `decryptPHI` rejects it at the
   * point of tampering.
   *
   * This is the same envelope `src/common/transformers/phi-gcm.transformer.ts`
   * already writes, deliberately, so both PHI paths stay readable by one set
   * of eyes.
   */
  encryptPHI(data: any): string {
    const salt = crypto.randomBytes(SALT_LEN);
    const iv = crypto.randomBytes(IV_LEN);
    const key = crypto.scryptSync(this.encryptionKey, salt, KEY_LEN);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, ciphertext]).toString('base64');
  }

  /**
   * Reverses encryptPHI.
   *
   * Throws when the envelope is truncated or the tag does not verify. It does
   * not fall back to a null or an empty object: a caller that cannot tell
   * "no PHI" from "PHI that failed authentication" will eventually treat the
   * second as the first.
   */
  decryptPHI(encryptedData: string): any {
    const buf = Buffer.from(encryptedData, 'base64');
    if (buf.length <= SALT_LEN + IV_LEN + TAG_LEN) {
      throw new Error('Encrypted PHI payload is truncated or malformed');
    }

    const salt = buf.subarray(0, SALT_LEN);
    const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
    const ciphertext = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN);

    const key = crypto.scryptSync(this.encryptionKey, salt, KEY_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(plaintext);
  }

  /**
   * Records one PHI access.
   *
   * Previously this pushed onto an in-process array, so the trail HIPAA asks
   * for was discarded on every restart and was never shared between replicas —
   * two instances each held half an answer and neither knew it.
   *
   * The caller's `timestamp` is honoured rather than overwritten with `new
   * Date()`. An access queued during an outage and flushed later belongs at the
   * time it happened; `createdAt` records when the row was written, so the two
   * remain distinguishable.
   */
  async logAccess(log: HipaaAuditLog): Promise<void> {
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        action: log.action,
        userId: log.userId,
        timestamp: log.timestamp ?? new Date(),
        ipAddress: log.ipAddress ?? null,
        userAgent: log.userAgent ?? null,
      }),
    );
  }

  /**
   * Reads the audit trail, filtered on whichever arguments are supplied.
   *
   * The date bounds are pushed into the query rather than applied to a fetched
   * array. Filtering in memory means loading every audit row a deployment has
   * ever written in order to return a week of them, which is the one table
   * guaranteed to grow without limit.
   */
  async getAuditLogs(
    resourceType?: string,
    resourceId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<HipaaAuditLog[]> {
    const where: Record<string, unknown> = {};

    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;

    if (startDate && endDate) {
      where.timestamp = Between(startDate, endDate);
    } else if (startDate) {
      where.timestamp = MoreThanOrEqual(startDate);
    } else if (endDate) {
      where.timestamp = LessThanOrEqual(endDate);
    }

    const rows = await this.auditLogRepository.find({
      where,
      order: { timestamp: 'ASC' },
    });

    return rows.map((row) => ({
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      action: row.action,
      userId: row.userId,
      timestamp: row.timestamp,
      ipAddress: row.ipAddress ?? undefined,
      userAgent: row.userAgent ?? undefined,
    }));
  }

  /**
   * Stores a consent record and audits the fact that it was stored.
   *
   * Consents accumulate rather than replace: an earlier record for the same
   * patient and type stays, so a later withdrawal does not erase the evidence
   * that consent once existed.
   */
  async recordPatientConsent(consent: PatientConsent): Promise<void> {
    await this.consentRepository.save(
      this.consentRepository.create({
        patientId: consent.patientId,
        consentType: consent.consentType,
        consentGiven: consent.consentGiven,
        consentDate: consent.consentDate ?? new Date(),
        expirationDate: consent.expirationDate ?? null,
      }),
    );

    await this.logAccess({
      resourceType: 'PatientConsent',
      resourceId: consent.patientId,
      action: 'CONSENT_RECORDED',
      userId: 'system',
      timestamp: new Date(),
    });
  }

  /**
   * Answers whether a patient currently permits a category of use.
   *
   * The newest record for the patient and type decides, so a withdrawal
   * recorded after a grant wins. An expiry in the past means no consent; a
   * null expiry means it does not lapse.
   */
  async verifyPatientConsent(
    patientId: string,
    consentType: string = 'telemedicine',
  ): Promise<boolean> {
    const latest = await this.consentRepository.findOne({
      where: { patientId, consentType },
      order: { consentDate: 'DESC' },
    });

    if (!latest || !latest.consentGiven) {
      return false;
    }

    return !latest.expirationDate || latest.expirationDate > new Date();
  }

  // Minimum Necessary Rule
  filterPHI(data: any, requestedFields: string[]): any {
    // Return only the minimum necessary PHI for the specific purpose
    const filtered: any = {};

    requestedFields.forEach((field) => {
      if (data[field] !== undefined) {
        filtered[field] = data[field];
      }
    });

    return filtered;
  }

  // De-identification
  deidentifyData(data: any): any {
    const deidentified = { ...data };

    // Remove direct identifiers (HIPAA Safe Harbor method)
    const identifiers = [
      'name',
      'address',
      'dateOfBirth',
      'phoneNumber',
      'email',
      'ssn',
      'medicalRecordNumber',
      'accountNumber',
      'certificateNumber',
      'vehicleIdentifier',
      'deviceIdentifier',
      'webUrl',
      'ipAddress',
      'biometricIdentifier',
      'facePhoto',
      'otherUniqueIdentifier',
    ];

    identifiers.forEach((identifier) => {
      if (deidentified[identifier]) {
        delete deidentified[identifier];
      }
    });

    // Age over 89 should be aggregated
    if (deidentified.age && deidentified.age > 89) {
      deidentified.age = '90+';
    }

    // Dates should be limited to year only
    if (deidentified.admitDate) {
      deidentified.admitYear = new Date(deidentified.admitDate).getFullYear();
      delete deidentified.admitDate;
    }

    return deidentified;
  }

  // Access Control Validation
  async validateAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
  ): Promise<{ authorized: boolean; reason?: string }> {
    // In production: Check role-based access control (RBAC)
    // This is a simplified example

    // Log access attempt
    await this.logAccess({
      resourceType,
      resourceId,
      action,
      userId,
      timestamp: new Date(),
    });

    // Implement role-based checks
    // For now, return authorized
    return { authorized: true };
  }

  // Breach Detection
  async detectPotentialBreach(logs: HipaaAuditLog[]): Promise<{
    hasPotentialBreach: boolean;
    breaches: any[];
  }> {
    const breaches: any[] = [];

    // Check for unusual access patterns
    const userAccessCounts = new Map<string, number>();

    logs.forEach((log) => {
      const count = userAccessCounts.get(log.userId) || 0;
      userAccessCounts.set(log.userId, count + 1);
    });

    // Flag users with unusually high access counts
    userAccessCounts.forEach((count, userId) => {
      if (count > 100) {
        // Threshold
        breaches.push({
          type: 'UNUSUAL_ACCESS_VOLUME',
          userId,
          accessCount: count,
          severity: 'HIGH',
        });
      }
    });

    // Check for after-hours access
    logs.forEach((log) => {
      const hour = log.timestamp.getHours();
      if (hour < 6 || hour > 22) {
        breaches.push({
          type: 'AFTER_HOURS_ACCESS',
          userId: log.userId,
          timestamp: log.timestamp,
          severity: 'MEDIUM',
        });
      }
    });

    return {
      hasPotentialBreach: breaches.length > 0,
      breaches,
    };
  }

  // Generate HIPAA Compliance Report
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    const logs = await this.getAuditLogs(undefined, undefined, startDate, endDate);

    const report = {
      period: { startDate, endDate },
      totalAccessLogs: logs.length,
      uniqueUsers: new Set(logs.map((l) => l.userId)).size,
      accessByResourceType: {},
      accessByAction: {},
      potentialBreaches: [],
      consentVerificationRate: 100, // Placeholder
      encryptionCompliance: 100, // Placeholder
      auditLogCompleteness: 100, // Placeholder
    };

    // Group by resource type
    logs.forEach((log) => {
      report.accessByResourceType[log.resourceType] =
        (report.accessByResourceType[log.resourceType] || 0) + 1;

      report.accessByAction[log.action] = (report.accessByAction[log.action] || 0) + 1;
    });

    // Detect breaches
    const breachDetection = await this.detectPotentialBreach(logs);
    report.potentialBreaches = breachDetection.breaches;

    return report;
  }

  // Data Retention Compliance
  async checkDataRetention(
    resourceType: string,
    createdDate: Date,
  ): Promise<{ shouldRetain: boolean; retentionYears: number }> {
    // HIPAA requires 6 years retention
    const retentionYears = 6;
    const expirationDate = new Date(createdDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + retentionYears);

    return {
      shouldRetain: new Date() < expirationDate,
      retentionYears,
    };
  }

  // Business Associate Agreement (BAA) Verification
  async verifyBAA(vendorId: string): Promise<boolean> {
    // In production: Check BAA database
    // Verify that all third-party vendors have signed BAAs
    return true;
  }

  // Emergency Access Override
  async grantEmergencyAccess(
    userId: string,
    patientId: string,
    reason: string,
  ): Promise<{ accessGranted: boolean; accessToken: string }> {
    // Generate temporary access token
    const accessToken = crypto.randomBytes(32).toString('hex');

    await this.logAccess({
      resourceType: 'EmergencyAccess',
      resourceId: patientId,
      action: 'EMERGENCY_ACCESS_GRANTED',
      userId,
      timestamp: new Date(),
    });

    // In production: Store emergency access record with time limit
    return {
      accessGranted: true,
      accessToken,
    };
  }

  // Patient Rights Management
  async recordPatientRightsRequest(
    patientId: string,
    requestType: 'access' | 'amendment' | 'restriction' | 'accounting',
    details: any,
  ): Promise<void> {
    await this.logAccess({
      resourceType: 'PatientRights',
      resourceId: patientId,
      action: `PATIENT_REQUEST_${requestType.toUpperCase()}`,
      userId: patientId,
      timestamp: new Date(),
    });

    // In production: Create workflow for fulfilling request within 30 days
  }

  // Security Risk Assessment
  async performRiskAssessment(): Promise<any> {
    return {
      encryptionStatus: 'COMPLIANT',
      accessControlStatus: 'COMPLIANT',
      auditLogStatus: 'COMPLIANT',
      dataBackupStatus: 'COMPLIANT',
      incidentResponseStatus: 'COMPLIANT',
      vulnerabilities: [],
      recommendations: [
        'Implement multi-factor authentication for all users',
        'Conduct quarterly security awareness training',
        'Review and update incident response plan',
      ],
    };
  }
}
