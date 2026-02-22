import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
  IsObject,
  ValidateNested,
  MaxLength,
  IsInt,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TreatmentPlanStatus, ProcedureStatus } from '../../common/enums';

// Treatment Plan DTOs
export class CreateTreatmentPlanDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  primaryProviderId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TreatmentPlanStatus })
  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  diagnosisIds?: string[];

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  goals?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  objectives?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  interventions?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  medications?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  reviewSchedule?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientEducation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}

export class UpdateTreatmentPlanDto extends PartialType(CreateTreatmentPlanDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  updatedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  changeNotes?: string;
}

export class SearchTreatmentPlansDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  diagnosisId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  primaryProviderId?: string;

  @ApiPropertyOptional({ enum: TreatmentPlanStatus })
  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

// Medical Procedure DTOs
export class CreateMedicalProcedureDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  treatmentPlanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  procedureName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cptCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cptCodeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProcedureStatus })
  @IsOptional()
  @IsEnum(ProcedureStatus)
  status?: ProcedureStatus;

  @ApiProperty()
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facility?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  room?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preProcedureNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  preProcedureInstructions?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}

export class UpdateMedicalProcedureDto extends PartialType(CreateMedicalProcedureDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualStartTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualEndTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postProcedureNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  outcome?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}

// Care Plan Template DTOs
export class CreateCarePlanTemplateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  icd10Codes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  goals?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  objectives?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  interventions?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  medications?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  customizableFields?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientEducation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}

export class UpdateCarePlanTemplateDto extends PartialType(CreateCarePlanTemplateDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}

export class ApplyTemplateDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty()
  @IsUUID()
  templateId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customizations?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}

// Treatment Outcome DTOs
export class CreateTreatmentOutcomeDto {
  @ApiProperty()
  @IsUUID()
  treatmentPlanId: string;

  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty()
  @IsDateString()
  recordedDate: string;

  @ApiProperty()
  @IsString()
  outcomeType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  clinicalMetrics?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  patientReportedOutcomes?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  qualityOfLifeScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  painScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clinicianNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  recordedBy?: string;
}

export class UpdateTreatmentOutcomeDto extends PartialType(CreateTreatmentOutcomeDto) {}
