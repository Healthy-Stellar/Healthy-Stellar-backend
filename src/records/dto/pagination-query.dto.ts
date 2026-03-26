import { IsOptional, IsEnum, IsDateString, IsIn, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RecordType } from './create-record.dto';

export enum SortBy {
  CREATED_AT = 'createdAt',
  RECORD_TYPE = 'recordType',
  PATIENT_ID = 'patientId',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class PaginationQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by record type',
    enum: RecordType,
    example: RecordType.MEDICAL_REPORT,
  })
  @IsOptional()
  @IsEnum(RecordType)
  recordType?: RecordType;

  @ApiPropertyOptional({
    description: 'Filter by start date (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: SortBy,
    example: SortBy.CREATED_AT,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy = SortBy.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    example: SortOrder.DESC,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsIn([SortOrder.ASC, SortOrder.DESC])
  order?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Filter by patient ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  patientId?: string;
}
