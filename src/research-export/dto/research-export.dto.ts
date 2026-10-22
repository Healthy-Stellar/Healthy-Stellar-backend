import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
import { RecordType } from '../../medical-records/entities/medical-record.entity';

export class ResearchExportFiltersDto {
  @IsEnum(RecordType)
  @IsOptional()
  recordType?: RecordType;

  @IsString()
  @IsOptional()
  fromYear?: string;

  @IsString()
  @IsOptional()
  toYear?: string;

  @IsString()
  @IsOptional()
  region?: string;

  /** When true, returns a sample of de-identified records without writing to S3. */
  @IsBoolean()
  @IsOptional()
  dryRun?: boolean;
}

/**
 * Query filter accepted by `POST /research-export/anonymized`.
 * Deliberately narrow — the endpoint streams NDJSON rather than persisting
 * to S3, so there is no dryRun/approval concept here, only the record
 * selection filter.
 */
export class AnonymizedExportFilterDto {
  @IsEnum(RecordType)
  @IsOptional()
  recordType?: RecordType;

  @IsString()
  @IsOptional()
  fromYear?: string;

  @IsString()
  @IsOptional()
  toYear?: string;

  @IsString()
  @IsOptional()
  region?: string;
}

/**
 * A single de-identified, k-anonymity-checked row emitted on the NDJSON stream.
 * Contains no direct identifiers — only generalised quasi-identifiers and
 * PII-stripped free text.
 */
export interface AnonymizedStreamRow {
  pseudoId: string;     // keyed, non-reversible hash of patientId (HMAC-SHA256)
  ageRange: string;     // e.g. "30-34" — generalised from dateOfBirth
  region: string;       // generalised from address (state/region only)
  recordType: string;
  yearOfRecord: number;
  clinicalSummary: string;
}

export interface AnonymizedRecord {
  pseudoId: string;       // reversible keyed pseudonym of patientId — no direct identifier
  ageBracket: string;     // e.g. "30-39"
  sex: string;
  region: string;         // state/country only, no city/zip/street
  yearOfRecord: number;   // full date reduced to year only
  recordType: string;
  clinicalSummary: string; // free-text with PII patterns stripped
}

export interface AnonymizedExport {
  exportId: string;
  researcherId: string;
  recordCount: number;
  exportedAt: string;
  storageRef: string | null; // null when dryRun=true
  records: AnonymizedRecord[];
}
