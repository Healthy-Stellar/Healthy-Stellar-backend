import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export type CohortExportFormat = 'json' | 'csv';

/**
 * Filters supported by the cohort query builder:
 *  - diagnosis code (ICD-10 code or medical_codes UUID)
 *  - admission date range
 *  - age range (computed from Patient.dateOfBirth)
 *  - ward (current bed/room/ward assignment)
 */
export class CohortQueryDto {
  @ApiPropertyOptional({
    description: 'ICD-10 code(s) to filter by, e.g. ["E11.9", "I10"]. Matched against medical_codes.code.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diagnosisCodes?: string[];

  @ApiPropertyOptional({ description: 'Admission date range start (inclusive), ISO 8601 date' })
  @IsOptional()
  @IsDateString()
  admissionDateFrom?: string;

  @ApiPropertyOptional({ description: 'Admission date range end (inclusive), ISO 8601 date' })
  @IsOptional()
  @IsDateString()
  admissionDateTo?: string;

  @ApiPropertyOptional({ description: 'Minimum patient age (inclusive), in years' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(150)
  minAge?: number;

  @ApiPropertyOptional({ description: 'Maximum patient age (inclusive), in years' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(150)
  maxAge?: number;

  @ApiPropertyOptional({ description: 'Ward UUID(s) the patient is currently assigned to', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  wardIds?: string[];

  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Response format', enum: ['json', 'csv'], default: 'json' })
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: CohortExportFormat = 'json';
}
