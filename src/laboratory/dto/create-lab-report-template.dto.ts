import { IsString, IsEnum, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { ReportType, ReportFormat } from '../entities/lab-report-template.entity';

export class CreateLabReportTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ReportType)
  type: ReportType;

  @IsEnum(ReportFormat)
  format: ReportFormat;

  @IsString()
  template: string;

  @IsOptional()
  @IsObject()
  styles?: Record<string, any>;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @IsOptional()
  @IsString()
  headerTemplate?: string;

  @IsOptional()
  @IsString()
  footerTemplate?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
