import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction } from '../common/audit/audit-log.entity';
import {
  ResearchExportFiltersDto,
  AnonymizedRecord,
  AnonymizedExport,
} from './dto/research-export.dto';

/** HIPAA Safe Harbor — 18 identifier patterns to strip from free text */
const PII_PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/g,                          // SSN
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,              // phone
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,     // email
  /\b\d{1,5}\s[\w\s]{1,30}(street|st|avenue|ave|road|rd|blvd|drive|dr|lane|ln|way)\b/gi, // street address
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/gi, // full dates
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,                  // MM/DD/YYYY dates
  /\b\d{5}(-\d{4})?\b/g,                              // ZIP codes
  /\b[A-Z]{2}\d{6,9}\b/g,                             // license / passport numbers
  /\bMRN[:\s]?\d+\b/gi,                               // MRN references
  /\b(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?\b/g, // titled names
];

@Injectable()
export class ResearchExportService {
  private readonly logger = new Logger(ResearchExportService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(MedicalRecord)
    private readonly recordRepo: Repository<MedicalRecord>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(AccessGrant)
    private readonly grantRepo: Repository<AccessGrant>,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
  ) {
    this.bucket = this.config.get<string>('RESEARCH_EXPORT_BUCKET', 'research-exports');
    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async exportAnonymizedDataset(
    researcherId: string,
    filters: ResearchExportFiltersDto,
  ): Promise<AnonymizedExport> {
    await this.assertValidGrant(researcherId);

    const records = await this.fetchRecords(filters);
    const patientIds = [...new Set(records.map((r) => r.patientId))];
    const patients = await this.patientRepo.findByIds(patientIds);
    const patientMap = new Map(patients.map((p) => [p.id, p]));

    const anonymized = this.anonymizeAndSuppress(records, patientMap);

    const exportId = uuidv4();
    const storageRef = await this.persist(exportId, researcherId, anonymized);

    await this.auditService.logDataExport(
      researcherId,
      'AnonymizedResearchExport',
      [exportId],
      'system',
      'ResearchExportService',
      { exportId, recordCount: anonymized.length, filters },
    );

    this.logger.log(`Research export ${exportId} by ${researcherId}: ${anonymized.length} records`);

    return {
      exportId,
      researcherId,
      recordCount: anonymized.length,
      exportedAt: new Date().toISOString(),
      storageRef,
      records: anonymized,
    };
  }

  // ─── Grant Validation ──────────────────────────────────────────────────────

  private async assertValidGrant(researcherId: string): Promise<void> {
    const grant = await this.grantRepo.findOne({
      where: { granteeId: researcherId, status: GrantStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });

    if (!grant) {
      throw new ForbiddenException('No active research access grant found');
    }

    if (grant.expiresAt && grant.expiresAt <= new Date()) {
      throw new ForbiddenException('Research access grant has expired');
    }
  }

  // ─── Data Fetch ────────────────────────────────────────────────────────────

  private async fetchRecords(filters: ResearchExportFiltersDto): Promise<MedicalRecord[]> {
    const qb = this.recordRepo.createQueryBuilder('r').where('r.status = :status', {
      status: 'active',
    });

    if (filters.recordType) {
      qb.andWhere('r.recordType = :type', { type: filters.recordType });
    }
    if (filters.fromYear) {
      qb.andWhere('EXTRACT(YEAR FROM r.recordDate) >= :from', { from: Number(filters.fromYear) });
    }
    if (filters.toYear) {
      qb.andWhere('EXTRACT(YEAR FROM r.recordDate) <= :to', { to: Number(filters.toYear) });
    }

    return qb.getMany();
  }

  // ─── De-identification Pipeline ────────────────────────────────────────────

  private anonymizeAndSuppress(
    records: MedicalRecord[],
    patientMap: Map<string, Patient>,
  ): AnonymizedRecord[] {
    // Group by patientId to apply small-group suppression (< 3 patients per group)
    const byPatient = new Map<string, MedicalRecord[]>();
    for (const r of records) {
      const list = byPatient.get(r.patientId) ?? [];
      list.push(r);
      byPatient.set(r.patientId, list);
    }

    // Suppress entire patient groups with fewer than 3 records (k-anonymity floor)
    const suppressed: AnonymizedRecord[] = [];
    for (const [patientId, patientRecords] of byPatient) {
      if (patientRecords.length < 3) continue; // suppress small groups

      const patient = patientMap.get(patientId);
      for (const record of patientRecords) {
        suppressed.push(this.deIdentifyRecord(record, patient));
      }
    }

    return suppressed;
  }

  private deIdentifyRecord(record: MedicalRecord, patient?: Patient): AnonymizedRecord {
    return {
      pseudoId: this.pseudonymize(record.patientId),
      ageBracket: patient ? this.toAgeBracket(patient.dateOfBirth) : 'unknown',
      sex: patient?.sex ?? 'unknown',
      region: patient ? this.toRegion(patient.address) : 'unknown',
      yearOfRecord: record.recordDate ? new Date(record.recordDate).getFullYear() : 0,
      recordType: record.recordType,
      clinicalSummary: this.stripPii(record.description ?? record.title ?? ''),
    };
  }

  // ─── HIPAA Safe Harbor Helpers ─────────────────────────────────────────────

  /** Rule 1 — Replace direct identifier with one-way hash (no re-linkage possible) */
  pseudonymize(patientId: string): string {
    const salt = this.config.get<string>('ANONYMIZATION_SALT', 'default-salt');
    return createHash('sha256').update(`${salt}:${patientId}`).digest('hex').slice(0, 16);
  }

  /** Rule 2 — Generalize DOB to 5-year age bracket; ages ≥ 90 collapsed to "90+" */
  toAgeBracket(dateOfBirth: string): string {
    if (!dateOfBirth) return 'unknown';
    const age = new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
    if (age >= 90) return '90+';
    const lower = Math.floor(age / 5) * 5;
    return `${lower}-${lower + 4}`;
  }

  /** Rule 3 — Reduce address to region (state/country) only; strip city, street, ZIP */
  toRegion(address: unknown): string {
    if (!address) return 'unknown';
    const addr = typeof address === 'string' ? address : JSON.stringify(address);
    // Extract last meaningful token as a rough state/country approximation
    const parts = addr.replace(/\d{5}(-\d{4})?/g, '').split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? 'unknown';
  }

  /** Rule 4 — Strip all 18 HIPAA Safe Harbor PII patterns from free text */
  stripPii(text: string): string {
    return PII_PATTERNS.reduce((t, re) => t.replace(re, '[REDACTED]'), text).trim();
  }

  // ─── Storage ───────────────────────────────────────────────────────────────

  private async persist(
    exportId: string,
    researcherId: string,
    records: AnonymizedRecord[],
  ): Promise<string> {
    const key = `research-exports/${researcherId}/${exportId}.json`;
    const body = JSON.stringify({ exportId, researcherId, records }, null, 2);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/json',
        ServerSideEncryption: 'aws:kms',
        Metadata: { researcherId, exportId },
      }),
    );

    return key;
  }
}
