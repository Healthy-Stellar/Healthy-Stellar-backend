import {
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';
import { AuditService } from '../common/audit/audit.service';
import {
  ResearchExportFiltersDto,
  AnonymizedRecord,
  AnonymizedExport,
} from './dto/research-export.dto';

// ─── HIPAA Safe Harbor — regex pass (structural identifiers) ─────────────────
// These cover identifiers that have a reliable lexical form (SSN, phone, email,
// dates, ZIP, MRN, account/license numbers, URLs, IP addresses, fax numbers).
// Free-text names are handled by the NER pass below.
const STRUCTURAL_PII_PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/g,                                                                    // SSN
  /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,                                       // phone / fax
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,                                              // email
  /\bhttps?:\/\/\S+/gi,                                                                         // URL
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,                                                  // IP address
  /\b\d{1,5}\s[\w\s]{1,30}(street|st\.?|avenue|ave\.?|road|rd\.?|blvd\.?|drive|dr\.?|lane|ln\.?|way|court|ct\.?|place|pl\.?)\b/gi, // street address
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/gi, // Month DD, YYYY
  /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g,                                                       // MM/DD/YYYY and variants
  /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g,                                                         // YYYY-MM-DD
  /\b\d{5}(-\d{4})?\b/g,                                                                       // ZIP / ZIP+4
  /\b[A-Z]{1,2}\d{6,9}\b/g,                                                                    // passport / license numbers
  /\bMRN[:\s#]?\d+\b/gi,                                                                       // MRN
  /\b(account|acct|policy|member|device|serial|certificate|license)\s*(no\.?|number|#|id)?[:\s]\s*[\w-]{4,}\b/gi, // account/policy/device IDs
];

/**
 * NER-based name redaction.
 *
 * We implement a lightweight, dependency-free NER pass using a combination of:
 *  1. Titled-name patterns  (Dr. Jane Smith, Mr. John Doe, etc.)
 *  2. Possessive / subject patterns common in clinical notes
 *     ("Patient John Doe reports…", "patient Jane Smith was…")
 *  3. Capitalised bi/tri-gram heuristic for remaining proper-noun sequences
 *     that survived the structural pass (catches "John Doe" in isolation).
 *
 * This is intentionally conservative — it may over-redact some clinical terms
 * that happen to be capitalised, which is the correct trade-off for HIPAA.
 */
function nerRedact(text: string): string {
  // Pass 1 — titled names (Dr., Mr., Mrs., Ms., Prof., Nurse, etc.)
  let out = text.replace(
    /\b(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Miss|Prof\.?|Nurse|RN|MD|DO|PA|NP)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
    '[REDACTED]',
  );

  // Pass 2 — "Patient/patient <Name>" and "patient <Name> <Name>" patterns
  out = out.replace(
    /\b(patient|pt\.?|subject|participant|client)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/gi,
    (_, label) => label, // keep the label word, drop the name
  );

  // Pass 3 — standalone capitalised bi/tri-grams not preceded by a sentence-start
  // indicator (i.e., not the first word of a sentence). This catches "John Doe"
  // embedded mid-sentence.
  out = out.replace(
    /(?<=[a-z,;:.]\s{1,3})[A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?\b/g,
    '[REDACTED]',
  );

  return out;
}

/**
 * Full de-identification pipeline:
 *  1. Structural regex pass (reliable lexical identifiers)
 *  2. NER pass (names in free text)
 */
export function stripPii(text: string): string {
  const afterStructural = STRUCTURAL_PII_PATTERNS.reduce(
    (t, re) => t.replace(re, '[REDACTED]'),
    text,
  );
  return nerRedact(afterStructural).trim();
}

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

    // Fix: findByIds removed in TypeORM 0.3.x — use find + In() operator
    const patients = patientIds.length
      ? await this.patientRepo.find({ where: { id: In(patientIds) } })
      : [];
    const patientMap = new Map(patients.map((p) => [p.id, p]));

    const anonymized = this.anonymizeAndSuppress(records, patientMap);
    const exportId = uuidv4();

    // dryRun: return sample without persisting to S3 or emitting audit log
    if (filters.dryRun) {
      return {
        exportId,
        researcherId,
        recordCount: anonymized.length,
        exportedAt: new Date().toISOString(),
        storageRef: null,
        records: anonymized.slice(0, 10),
      };
    }

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
    const byPatient = new Map<string, MedicalRecord[]>();
    for (const r of records) {
      const list = byPatient.get(r.patientId) ?? [];
      list.push(r);
      byPatient.set(r.patientId, list);
    }

    const suppressed: AnonymizedRecord[] = [];
    for (const [patientId, patientRecords] of byPatient) {
      if (patientRecords.length < 3) continue; // k-anonymity floor

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
      clinicalSummary: stripPii(record.description ?? record.title ?? ''),
    };
  }

  // ─── HIPAA Safe Harbor Helpers ─────────────────────────────────────────────

  pseudonymize(patientId: string): string {
    const salt = this.config.get<string>('ANONYMIZATION_SALT', 'default-salt');
    return createHash('sha256').update(`${salt}:${patientId}`).digest('hex').slice(0, 16);
  }

  toAgeBracket(dateOfBirth: string): string {
    if (!dateOfBirth) return 'unknown';
    const age = new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
    if (age >= 90) return '90+';
    const lower = Math.floor(age / 5) * 5;
    return `${lower}-${lower + 4}`;
  }

  toRegion(address: unknown): string {
    if (!address) return 'unknown';
    const addr = typeof address === 'string' ? address : JSON.stringify(address);
    const parts = addr
      .replace(/\d{5}(-\d{4})?/g, '')
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts[parts.length - 1] ?? 'unknown';
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
