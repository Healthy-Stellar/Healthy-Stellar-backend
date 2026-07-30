import {
  IsString,
  IsEnum,
  IsArray,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ReportFormat } from '../entities/report-job.entity';
import { ReportFrequency } from '../entities/report-schedule.entity';

export class CreateReportScheduleDto {
  @IsString()
  reportType: string;

  @IsEnum(ReportFrequency)
  frequency: ReportFrequency;

  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @IsInt()
  @Min(1)
  @Max(28)
  @IsOptional()
  dayOfMonth?: number;

  @IsArray()
  @IsEmail({}, { each: true })
  recipients: string[];

  @IsEnum(ReportFormat)
  @IsOptional()
  format?: ReportFormat;
}

export class UpdateReportScheduleDto {
  @IsString()
  @IsOptional()
  reportType?: string;

  @IsEnum(ReportFrequency)
  @IsOptional()
  frequency?: ReportFrequency;

  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @IsInt()
  @Min(1)
  @Max(28)
  @IsOptional()
  dayOfMonth?: number;

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  recipients?: string[];

  @IsEnum(ReportFormat)
  @IsOptional()
  format?: ReportFormat;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
