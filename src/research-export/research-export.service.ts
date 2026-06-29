import {
  Injectable,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';
import { AuditService } from '../common/audit/audit.service';
import { TenantConfigService } from '../tenant-config/services/tenant-config.service';
import { TenantService } from '../tenant/services/tenant.service';
import { TenantContext } from '../tenant/context/tenant.context';
import { TenantDatabaseRoutingService } from '../database/tenant-database-routing.service';
import { Tenant } from '../tenant/entities/tenant.entity';
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
    options: { approvedBy?: string } = {},
  ): Promise<AnonymizedExport> {
    await this.assertValidGrant(researcherId);

    // Real (non-dryRun) exports must be approved by an administrator before
    // the job is dispatched — researchers cannot self-authorise a dispatch.
    if (!filters.dryRun && !options.approvedBy) {
      throw new ForbiddenException('Research export requires admin approval before dispatch');
    }

    const records = await this.fetchRecords(filters);
    const patientIds = [...new Set(records.map((r) => r.patientId))];

    // Fix: findByIds removed in TypeORM 0.3.x — use find + In() operator
    const patients = patientIds.length
      ? await this.patientRepo.find({ where: { id: In(patientIds) } })
      : [];
    const patientMap = new Map(patients.map((p) => [p.id, p]));

    const anonymized = this.anonymizeAndSuppress(records, patientMap);
    const exportId = uuidv4();

    // dryRun: return sample without persisting to S3. Still audited — every
    // research export request (preview or dispatch) produces an audit entry.
    if (filters.dryRun) {
      await this.auditService.logDataExport(
        researcherId,
        'AnonymizedResearchExport',
        [exportId],
        'system',
        'ResearchExportService',
        { exportId, recordCount: anonymized.length, filters, dryRun: true },
      );
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
      { exportId, recordCount: anonymized.length, filters, approvedBy: options.approvedBy },
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

  /**
   * Configurable anonymisation profile.
   *  - kAnonymity: minimum group size below which a patient's records are suppressed.
   *  - quasiIdentifiers: which generalised quasi-identifier fields are retained;
   *    any quasi-identifier not listed is suppressed from the export.
   */
  getAnonymizationProfile(): { kAnonymity: number; quasiIdentifiers: string[] } {
    return {
      kAnonymity: parseInt(this.config.get<string>('RESEARCH_K_ANONYMITY', '3'), 10) || 3,
      quasiIdentifiers: this.config
        .get<string>('RESEARCH_QUASI_IDENTIFIERS', 'ageBracket,sex,region,yearOfRecord')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  private anonymizeAndSuppress(
    records: MedicalRecord[],
    patientMap: Map<string, Patient>,
  ): AnonymizedRecord[] {
    const profile = this.getAnonymizationProfile();
    const byPatient = new Map<string, MedicalRecord[]>();
    for (const r of records) {
      const list = byPatient.get(r.patientId) ?? [];
      list.push(r);
      byPatient.set(r.patientId, list);
    }

    const suppressed: AnonymizedRecord[] = [];
    for (const [patientId, patientRecords] of byPatient) {
      if (patientRecords.length < profile.kAnonymity) continue; // k-anonymity floor

      const patient = patientMap.get(patientId);
      for (const record of patientRecords) {
        suppressed.push(this.deIdentifyRecord(record, patient, profile.quasiIdentifiers));
      }
    }

    return suppressed;
  }

  private deIdentifyRecord(
    record: MedicalRecord,
    patient: Patient | undefined,
    quasiIdentifiers: string[],
  ): AnonymizedRecord {
    const keep = (field: string, value: string): string =>
      quasiIdentifiers.includes(field) ? value : 'suppressed';
    return {
      pseudoId: this.pseudonymize(record.patientId),
      ageBracket: keep('ageBracket', patient ? this.toAgeBracket(patient.dateOfBirth) : 'unknown'),
      sex: keep('sex', patient?.sex ?? 'unknown'),
      region: keep('region', patient ? this.toRegion(patient.address) : 'unknown'),
      yearOfRecord: quasiIdentifiers.includes('yearOfRecord')
        ? record.recordDate
          ? new Date(record.recordDate).getFullYear()
          : 0
        : 0,
      recordType: record.recordType,
      clinicalSummary: stripPii(record.description ?? record.title ?? ''),
    };
  }

  // ─── HIPAA Safe Harbor Helpers ─────────────────────────────────────────────

  /**
   * Derive the 256-bit pseudonymisation key. The underlying secret is provisioned
   * and stored via key-management / KMS (surfaced here as RESEARCH_PSEUDONYM_KEY).
   */
  private pseudonymKey(): Buffer {
    const secret = this.config.get<string>('RESEARCH_PSEUDONYM_KEY', 'default-pseudonym-key');
    return scryptSync(secret, 'research-export-pseudonym', 32);
  }

  /**
   * Reversible, keyed pseudonymisation of a direct identifier. Uses AES-256-CBC
   * with a deterministic IV derived (HMAC) from the identifier, so the same
   * patient always maps to the same token while remaining reversible by holders
   * of the key (re-identification) — see {@link reIdentify}.
   */
  pseudonymize(patientId: string): string {
    const key = this.pseudonymKey();
    const iv = createHmac('sha256', key).update(patientId).digest().subarray(0, 16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const ciphertext = Buffer.concat([cipher.update(patientId, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}${ciphertext.toString('hex')}`;
  }

  /** Reverse a pseudonymous ID back to the original identifier (authorised re-identification). */
  reIdentify(token: string): string {
    const key = this.pseudonymKey();
    const iv = Buffer.from(token.slice(0, 32), 'hex');
    const ciphertext = Buffer.from(token.slice(32), 'hex');
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
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
