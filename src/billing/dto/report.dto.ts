import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportType {
  REVENUE_SUMMARY = 'revenue_summary',
  AR_AGING = 'ar_aging',
  PAYER_MIX = 'payer_mix',
  DENIAL_ANALYSIS = 'denial_analysis',
  COLLECTION_PERFORMANCE = 'collection_performance',
  PROVIDER_PRODUCTIVITY = 'provider_productivity',
  PROCEDURE_ANALYSIS = 'procedure_analysis',
}

export enum PeriodType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export class GenerateReportDto {
  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  reportType: ReportType;

  @ApiProperty({ enum: PeriodType })
  @IsEnum(PeriodType)
  periodType: PeriodType;

  @ApiProperty()
  @IsDateString()
  periodStart: string;

  @ApiProperty()
  @IsDateString()
  periodEnd: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facilityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReportSearchDto {
  @ApiPropertyOptional({ enum: ReportType })
  @IsOptional()
  @IsEnum(ReportType)
  reportType?: ReportType;

  @ApiPropertyOptional({ enum: PeriodType })
  @IsOptional()
  @IsEnum(PeriodType)
  periodType?: PeriodType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ARAgingReportDto {
  @ApiProperty()
  @IsDateString()
  asOfDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerId?: string;
}

export class DenialAnalysisDto {
  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  denialReason?: string;
}
