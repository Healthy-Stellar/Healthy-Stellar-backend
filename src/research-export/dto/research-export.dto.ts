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

export interface AnonymizedRecord {
  pseudoId: string;       // one-way hash of patientId — no direct identifier
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
