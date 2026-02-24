import { IsString, IsUUID, IsEnum, IsOptional, IsDateString, IsArray } from 'class-validator';
import { CaseType, CasePriority } from '../entities/pathology-case.entity';

export class CreatePathologyCaseDto {
  @IsUUID()
  patientId: string;

  @IsString()
  patientName: string;

  @IsUUID()
  orderingPhysicianId: string;

  @IsString()
  orderingPhysicianName: string;

  @IsEnum(CaseType)
  caseType: CaseType;

  @IsEnum(CasePriority)
  @IsOptional()
  priority?: CasePriority;

  @IsDateString()
  @IsOptional()
  caseDate?: string;

  @IsString()
  clinicalHistory: string;

  @IsString()
  @IsOptional()
  clinicalIndication?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  departmentName?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
