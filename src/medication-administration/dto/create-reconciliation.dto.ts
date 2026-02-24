import { IsUUID, IsString, IsEnum, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ReconciliationType } from '../entities/medication-reconciliation.entity';

export class CreateReconciliationDto {
  @IsUUID()
  patientId: string;

  @IsEnum(ReconciliationType)
  reconciliationType: ReconciliationType;

  @IsUUID()
  initiatedBy: string;

  @IsString()
  initiatedByName: string;

  @IsString()
  initiatedByRole: string;

  @IsOptional()
  @IsUUID()
  pharmacistId?: string;

  @IsOptional()
  @IsString()
  pharmacistName?: string;

  @IsOptional()
  @IsUUID()
  physicianId?: string;

  @IsOptional()
  @IsString()
  physicianName?: string;

  @IsOptional()
  @IsArray()
  homeMedications?: any[];

  @IsOptional()
  @IsArray()
  currentMedications?: any[];

  @IsOptional()
  @IsString()
  reconciliationNotes?: string;

  @IsOptional()
  @IsBoolean()
  patientInterviewCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  familyInterviewCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  pharmacyContacted?: boolean;

  @IsOptional()
  @IsBoolean()
  primaryCareContacted?: boolean;
}
