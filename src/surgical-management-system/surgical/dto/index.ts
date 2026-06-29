import {
  IsString,
  IsEnum,
  IsDate,
  IsInt,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  Min,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  SurgeryType,
  CaseStatus,
  RoomStatus,
  TeamRole,
  EquipmentStatus,
} from '../entities';

// Surgical Case DTOs
export class CreateSurgicalCaseDto {
  @IsString()
  patientId: string;

  @IsString()
  patientName: string;

  @IsString()
  procedureName: string;

  @IsString()
  @IsOptional()
  procedureDescription?: string;

  @IsEnum(SurgeryType)
  surgeryType: SurgeryType;

  @Type(() => Date)
  @IsDate()
  scheduledDate: Date;

  @IsInt()
  @Min(1)
  estimatedDuration: number;

  @IsUUID()
  @IsOptional()
  operatingRoomId?: string;

  @IsString()
  @IsOptional()
  primarySurgeonId?: string;

  @IsString()
  @IsOptional()
  preOpNotes?: string;

  @IsString()
  @IsOptional()
  specialRequirements?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredEquipment?: string[];
}

export class UpdateSurgicalCaseDto {
  @IsString()
  @IsOptional()
  procedureName?: string;

  @IsString()
  @IsOptional()
  procedureDescription?: string;

  @IsEnum(SurgeryType)
  @IsOptional()
  surgeryType?: SurgeryType;

  @IsEnum(CaseStatus)
  @IsOptional()
  status?: CaseStatus;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  scheduledDate?: Date;

  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedDuration?: number;

  @IsUUID()
  @IsOptional()
  operatingRoomId?: string;

  @IsString()
  @IsOptional()
  preOpNotes?: string;

  @IsString()
  @IsOptional()
  specialRequirements?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredEquipment?: string[];
}

export class StartSurgeryDto {
  @Type(() => Date)
  @IsDate()
  actualStartTime: Date;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CompleteSurgeryDto {
  @Type(() => Date)
  @IsDate()
  actualEndTime: Date;

  @IsString()
  @IsOptional()
  notes?: string;
}

// Pre-Operative Checklist DTOs
export class SurgicalChecklistItemDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  label: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  completed: boolean;
}

export class SubmitSurgicalChecklistDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurgicalChecklistItemDto)
  items: SurgicalChecklistItemDto[];
}

// Operating Room DTOs
export class CreateOperatingRoomDto {
  @IsString()
  roomNumber: string;

  @IsString()
  roomName: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  capabilities?: string[];

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsOptional()
  equipment?: Record<string, any>;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateOperatingRoomDto {
  @IsString()
  @IsOptional()
  roomName?: string;

  @IsEnum(RoomStatus)
  @IsOptional()
  status?: RoomStatus;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  capabilities?: string[];

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  equipment?: Record<string, any>;

  @IsString()
  @IsOptional()
  notes?: string;
}

// Room Booking DTOs
export class CreateRoomBookingDto {
  @IsUUID()
  operatingRoomId: string;

  @IsUUID()
  @IsOptional()
  surgicalCaseId?: string;

  @Type(() => Date)
  @IsDate()
  startTime: Date;

  @Type(() => Date)
  @IsDate()
  endTime: Date;

  @IsBoolean()
  @IsOptional()
  isBlocked?: boolean;

  @IsString()
  @IsOptional()
  blockingReason?: string;
}

export class CheckAvailabilityDto {
  @Type(() => Date)
  @IsDate()
  startTime: Date;

  @Type(() => Date)
  @IsDate()
  endTime: Date;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredCapabilities?: string[];
}

// Team Member DTOs
export class AssignTeamMemberDto {
  @IsUUID()
  surgicalCaseId: string;

  @IsString()
  staffId: string;

  @IsString()
  staffName: string;

  @IsEnum(TeamRole)
  role: TeamRole;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateTeamMemberDto {
  @IsBoolean()
  @IsOptional()
  isConfirmed?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

// Equipment DTOs
export class CreateEquipmentDto {
  @IsString()
  equipmentCode: string;

  @IsString()
  equipmentName: string;

  @IsString()
  equipmentType: string;

  @IsString()
  @IsOptional()
  currentLocationId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateEquipmentDto {
  @IsEnum(EquipmentStatus)
  @IsOptional()
  status?: EquipmentStatus;

  @IsString()
  @IsOptional()
  currentLocationId?: string;

  @IsString()
  @IsOptional()
  assignedCaseId?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  lastSterilizedAt?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  nextMaintenanceDate?: Date;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecordEquipmentMaintenanceDto {
  @IsUUID()
  equipmentId: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsString()
  type: string;

  @IsString()
  notes: string;
}

// Operative Note DTOs
export class CreateOperativeNoteDto {
  @IsUUID()
  surgicalCaseId: string;

  @IsString()
  surgeonId: string;

  @IsString()
  surgeonName: string;

  @IsString()
  preOpDiagnosis: string;

  @IsString()
  postOpDiagnosis: string;

  @IsString()
  procedurePerformed: string;

  @IsString()
  findingsAndTechnique: string;

  @IsString()
  @IsOptional()
  complications?: string;

  @IsString()
  @IsOptional()
  specimensSent?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedBloodLoss?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  antibioticsGiven?: string[];

  @IsString()
  postOpInstructions: string;

  @IsString()
  @IsOptional()
  additionalNotes?: string;

  @Type(() => Date)
  @IsDate()
  dictatedAt: Date;
}

export class SignOperativeNoteDto {
  @IsUUID()
  noteId: string;

  @Type(() => Date)
  @IsDate()
  signedAt: Date;
}

// Surgical Outcome DTOs
export class CreateSurgicalOutcomeDto {
  @IsUUID()
  surgicalCaseId: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  patientSatisfactionScore?: number;

  @IsBoolean()
  @IsOptional()
  hadComplications?: boolean;

  @IsString()
  @IsOptional()
  complicationDetails?: string;

  @IsBoolean()
  @IsOptional()
  hadReadmission?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  readmissionDays?: number;

  @IsBoolean()
  @IsOptional()
  hadInfection?: boolean;

  @IsBoolean()
  @IsOptional()
  hadMortality?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  lengthOfStay?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedCost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualCost?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  timeFromIncisionToClosure?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  anesthesiaTime?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  turnoverTime?: number;

  @IsBoolean()
  @IsOptional()
  prophylacticAntibioticsGiven?: boolean;

  @IsBoolean()
  @IsOptional()
  dvtProphylaxisGiven?: boolean;

  @IsBoolean()
  @IsOptional()
  normothermiaMaintained?: boolean;

  @IsString()
  @IsOptional()
  qualityNotes?: string;

  @IsOptional()
  customMetrics?: Record<string, any>;
}

export class UpdateSurgicalOutcomeDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  patientSatisfactionScore?: number;

  @IsBoolean()
  @IsOptional()
  hadComplications?: boolean;

  @IsString()
  @IsOptional()
  complicationDetails?: string;

  @IsBoolean()
  @IsOptional()
  hadReadmission?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  readmissionDays?: number;

  @IsBoolean()
  @IsOptional()
  hadInfection?: boolean;

  @IsBoolean()
  @IsOptional()
  hadMortality?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  lengthOfStay?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedCost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualCost?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  timeFromIncisionToClosure?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  anesthesiaTime?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  turnoverTime?: number;

  @IsBoolean()
  @IsOptional()
  prophylacticAntibioticsGiven?: boolean;

  @IsBoolean()
  @IsOptional()
  dvtProphylaxisGiven?: boolean;

  @IsBoolean()
  @IsOptional()
  normothermiaMaintained?: boolean;

  @IsString()
  @IsOptional()
  qualityNotes?: string;

  @IsOptional()
  customMetrics?: Record<string, any>;
}

// Query DTOs
export class ScheduleQueryDto {
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endDate?: Date;

  @IsEnum(CaseStatus)
  @IsOptional()
  status?: CaseStatus;

  @IsUUID()
  @IsOptional()
  operatingRoomId?: string;

  @IsString()
  @IsOptional()
  surgeonId?: string;
}

export class QualityMetricsQueryDto {
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endDate?: Date;

  @IsString()
  @IsOptional()
  procedureType?: string;

  @IsString()
  @IsOptional()
  surgeonId?: string;

  @IsString()
  @IsOptional()
  roomId?: string;
}