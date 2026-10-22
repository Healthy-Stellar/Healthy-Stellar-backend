import { IsOptional, IsArray, IsIn, IsISO8601, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const SUPPORTED_OUTPUT_FORMATS = [
  'application/fhir+ndjson',
  'application/ndjson',
  'ndjson',
] as const;

export type BulkOutputFormat = (typeof SUPPORTED_OUTPUT_FORMATS)[number];

export class BulkExportQueryDto {
  @ApiPropertyOptional({
    description: 'Resource types to export',
    example: 'Patient,DocumentReference',
  })
  @IsOptional()
  @IsArray()
  @IsIn(['Patient', 'DocumentReference', 'Consent', 'Provenance'], { each: true })
  _type?: string[];

  @ApiPropertyOptional({
    description: 'Only include resources updated after this ISO 8601 instant',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  _since?: string;

  @ApiPropertyOptional({
    description: 'Requested output format',
    example: 'application/fhir+ndjson',
    default: 'application/fhir+ndjson',
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_OUTPUT_FORMATS)
  _outputFormat?: BulkOutputFormat;
}

export interface BulkExportStatusResponse {
  transactionTime: string;
  request: string;
  requiresAccessToken: boolean;
  output: Array<{ type: string; url: string; count: number }>;
  error?: Array<{ type: string; url: string }>;
}
