import {
  IsUUID,
  IsEnum,
  IsString,
  IsDateString,
  IsInt,
  IsIn,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecordType, MedicalRecordStatus } from '../entities/medical-record.entity';

/**
 * Allowlist of columns that are safe to sort by.
 * Keys are the values callers may pass in `sortBy`; values are the actual
 * column expressions used server-side (see medical-records.service.ts).
 * Only add a column here if it is a real, non-sensitive, indexed column —
 * this list is the single source of truth for what `ORDER BY` is allowed
 * to touch, so it directly prevents SQL injection / column enumeration
 * via the sort parameter.
 */
export enum MedicalRecordSortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  RECORD_TYPE = 'recordType',
  STATUS = 'status',
  TITLE = 'title',
}

export class SearchMedicalRecordsDto {
  @ApiPropertyOptional({ description: 'Patient ID to filter by' })
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

  @ApiPropertyOptional({ description: 'Search in title and description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Start date for date range filter' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for date range filter' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: MedicalRecordSortField,
    default: MedicalRecordSortField.CREATED_AT,
  })
  @IsEnum(MedicalRecordSortField)
  @IsOptional()
  sortBy: MedicalRecordSortField = MedicalRecordSortField.CREATED_AT;

  @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  sortOrder: 'ASC' | 'DESC' = 'DESC';
}