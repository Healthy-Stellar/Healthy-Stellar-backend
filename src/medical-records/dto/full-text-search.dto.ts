import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordType, MedicalRecordStatus } from '../entities/medical-record.entity';

/**
 * DTO for POST /medical-records/search query with full-text relevance ranking.
 *
 * Supports:
 *  - Free-text query via `q` parameter (uses PostgreSQL websearch_to_tsquery)
 *  - Phrase search (double-quoted terms in `q`)
 *  - Proximity operators (e.g. `diabetes <-> hypertension`)
 *  - Optional filtered facets (patientId, recordType, status, date range)
 *  - Pagination and sorting
 */
export class FullTextSearchDto {
  @ApiProperty({
    description:
      'Full-text search query. Supports phrase search ("double quoted"), ' +
      'AND/OR operators, and proximity operators (<-> for adjacent terms).',
    example: 'hypertension diabetes',
  })
  @IsString()
  q: string;

  @ApiPropertyOptional({
    description: 'Patient ID to narrow search scope',
  })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ enum: RecordType, description: 'Filter by record type' })
  @IsEnum(RecordType)
  @IsOptional()
  recordType?: RecordType;

  @ApiPropertyOptional({ enum: MedicalRecordStatus, description: 'Filter by status' })
  @IsEnum(MedicalRecordStatus)
  @IsOptional()
  status?: MedicalRecordStatus;

  @ApiPropertyOptional({
    description: 'Start date for date range filter (ISO 8601)',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for date range filter (ISO 8601)',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
