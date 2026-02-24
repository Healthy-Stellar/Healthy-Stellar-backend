import { IsString, IsUUID, IsEnum, IsOptional, IsArray, IsDateString } from 'class-validator';
import { ReportType } from '../entities/pathology-report.entity';

export class CreatePathologyReportDto {
  @IsUUID()
  pathologyCaseId: string;

  @IsUUID()
  @IsOptional()
  templateId?: string;

  @IsEnum(ReportType)
  @IsOptional()
  reportType?: ReportType;

  @IsString()
  clinicalInformation: string;

  @IsString()
  grossDescription: string;

  @IsString()
  microscopicDescription: string;

  @IsString()
  diagnosis: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsOptional()
  synopticData?: Record<string, any>;

  @IsString()
  @IsOptional()
  tnmStaging?: string;

  @IsString()
  @IsOptional()
  marginStatus?: string;

  @IsString()
  @IsOptional()
  lymphNodeStatus?: string;

  @IsArray()
  @IsOptional()
  icd10Codes?: string[];

  @IsArray()
  @IsOptional()
  cptCodes?: string[];

  @IsUUID()
  pathologistId: string;

  @IsString()
  pathologistName: string;

  @IsDateString()
  @IsOptional()
  reportDate?: string;

  @IsArray()
  @IsOptional()
  distributionList?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
