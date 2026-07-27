import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { AnonymizedStreamRow } from './dto/research-export.dto';
import { stripPii } from './research-export.service';

/**
 * Minimum group size required for a quasi-identifier combination to be
 * considered safe to export. Per issue #761, k must be >= 5 — any group
 * of records that share the same generalised quasi-identifiers (age range +
 * region + record type) and number fewer than this is suppressed.
 */
export const RESEARCH_EXPORT_MIN_K = 5;

/**
 * Anonymization + k-anonymity enforcement for the `/research-export/anonymized`
 * NDJSON stream. Deliberately separate from `ResearchExportService`'s existing
 * S3-dispatch pipeline (which has its own, configurable k-anonymity floor) —
 * this transform is non-reversible (hash, not keyed-encryption) since the
 * anonymized stream is not intended to support re-identification.
 */
@Injectable()
export class ResearchAnonymizerService {
  constructor(private readonly config: ConfigService) {}

  // ─── Direct identifier removal ─────────────────────────────────────────────

  /**
   * One-way, salted HMAC-SHA256 hash of a patient's direct identifier
   * (patientId / MRN / national ID). Deterministic for a given patient so
   * that records belonging to the same patient still group together for
   * k-anonymity purposes, but not reversible to the source identifier.
   */
  hashIdentifier(value: string): string {
    const secret = this.config.get<string>('RESEARCH_EXPORT_HASH_SALT', 'research-export-default-salt');
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  // ─── Quasi-identifier generalisation ───────────────────────────────────────

  /**
   * Generalise a date of birth to a 5-year age-range band (e.g. "30-34"),
   * collapsing everyone 90+ into a single open-ended band. Mirrors HIPAA
   * Safe Harbor guidance on age generalisation.
   */
  toAgeRange(dateOfBirth: string | null | undefined): string {
    if (!dateOfBirth) return 'unknown';
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return 'unknown';

    const age = new Date().getFullYear() - dob.getFullYear();
    if (age < 0) return 'unknown';
    if (age >= 90) return '90+';

    const lower = Math.floor(age / 5) * 5;
    return `${lower}-${lower + 4}`;
  }

  /**
   * Generalise a full address down to region only (state/province/country
   * token) — strips street, city, and postal code.
   */
  toRegion(address: unknown): string {
    if (!address) return 'unknown';
    const text = typeof address === 'string' ? address : JSON.stringify(address);

    try {
      const parsed = typeof address === 'string' ? null : address;
      if (parsed && typeof parsed === 'object') {
        const region =
          (parsed as Record<string, unknown>).state ??
          (parsed as Record<string, unknown>).region ??
          (parsed as Record<string, unknown>).province ??
          (parsed as Record<string, unknown>).country;
        if (typeof region === 'string' && region.trim()) {
          return region.trim();
        }
      }
    } catch {
      // fall through to string parsing
    }

    const parts = text
      .replace(/\d{5}(-\d{4})?/g, '') // strip ZIP/ZIP+4
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    return parts[parts.length - 1] ?? 'unknown';
  }

  // ─── Record-level transform ────────────────────────────────────────────────

  /**
   * Strip/generalise a single medical record + its patient into a row with
   * no direct identifiers — only hashed pseudo-id and generalised
   * quasi-identifiers remain.
   */
  anonymizeRecord(record: MedicalRecord, patient: Patient | undefined): AnonymizedStreamRow {
    return {
      pseudoId: this.hashIdentifier(record.patientId),
      ageRange: this.toAgeRange(patient?.dateOfBirth),
      region: this.toRegion(patient?.address),
      recordType: record.recordType,
      yearOfRecord: record.recordDate ? new Date(record.recordDate).getFullYear() : 0,
      clinicalSummary: stripPii(record.description ?? record.title ?? ''),
    };
  }

  // ─── k-anonymity enforcement ────────────────────────────────────────────────

  /**
   * Build the quasi-identifier key used to group rows for k-anonymity
   * purposes: age range + region + record type + year of record. Any
   * combination of these that appears in fewer than `k` rows is suppressed
   * entirely (not just truncated) so no group smaller than k is ever
   * disclosed.
   */
  private quasiIdentifierKey(row: AnonymizedStreamRow): string {
    return `${row.ageRange}|${row.region}|${row.recordType}|${row.yearOfRecord}`;
  }

  /**
   * Apply k-anonymity suppression (k >= RESEARCH_EXPORT_MIN_K) to a set of
   * already-anonymized rows. Groups rows by their quasi-identifier
   * combination and drops any group whose size is below k.
   *
   * Throws UnprocessableEntityException if suppression would leave zero
   * exportable rows (i.e. the filter is so narrow that no quasi-identifier
   * group can ever reach k) — callers must not return partial/unsafe data.
   */
  enforceKAnonymity(
    rows: AnonymizedStreamRow[],
    k: number = RESEARCH_EXPORT_MIN_K,
  ): AnonymizedStreamRow[] {
    const groups = new Map<string, AnonymizedStreamRow[]>();
    for (const row of rows) {
      const key = this.quasiIdentifierKey(row);
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }

    const safe: AnonymizedStreamRow[] = [];
    for (const group of groups.values()) {
      if (group.length >= k) {
        safe.push(...group);
      }
    }

    if (safe.length === 0) {
      throw new UnprocessableEntityException(
        `k-anonymity constraint (k>=${k}) could not be satisfied for this filter — ` +
          'no quasi-identifier group reaches the minimum group size. Broaden the filter and retry.',
      );
    }

    return safe;
  }
}
