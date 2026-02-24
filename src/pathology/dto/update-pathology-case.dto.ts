import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  IsNumber,
} from 'class-validator';
import { CaseStatus, CasePriority } from '../entities/pathology-case.entity';

export class UpdatePathologyCaseDto {
  @IsEnum(CaseStatus)
  @IsOptional()
  status?: CaseStatus;

  @IsEnum(CasePriority)
  @IsOptional()
  priority?: CasePriority;

  @IsUUID()
  @IsOptional()
  pathologistId?: string;

  @IsString()
  @IsOptional()
  pathologistName?: string;

  @IsUUID()
  @IsOptional()
  reviewPathologistId?: string;

  @IsString()
  @IsOptional()
  reviewPathologistName?: string;

  @IsString()
  @IsOptional()
  grossDescription?: string;

  @IsString()
  @IsOptional()
  microscopicFindings?: string;

  @IsString()
  @IsOptional()
  diagnosis?: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  @IsOptional()
  icdCodes?: string[];

  @IsArray()
  @IsOptional()
  cptCodes?: string[];

  @IsBoolean()
  @IsOptional()
  consultationRequested?: boolean;

  @IsString()
  @IsOptional()
  consultationNotes?: string;

  @IsNumber()
  @IsOptional()
  turnaroundTimeHours?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}
