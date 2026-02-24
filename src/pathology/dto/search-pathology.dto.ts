import { IsOptional, IsString, IsEnum, IsDateString, IsNumber, Min } from 'class-validator';
import { CaseType, CaseStatus, CasePriority } from '../entities/pathology-case.entity';

export class SearchPathologyDto {
  @IsOptional()
  @IsString()
  caseNumber?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  patientName?: string;

  @IsOptional()
  @IsString()
  orderingPhysicianId?: string;

  @IsOptional()
  @IsString()
  pathologistId?: string;

  @IsOptional()
  @IsEnum(CaseType)
  caseType?: CaseType;

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
