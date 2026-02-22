import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  CriticalAlertSeverity,
} from '../entities/critical-care-monitoring.entity';
import { DisasterIncidentStatus } from '../entities/emergency-documentation.entity';
import { EmergencyResourceStatus } from '../entities/emergency-resource.entity';
import { RapidResponseStatus } from '../entities/rapid-response-event.entity';
import { TriageQueueStatus } from '../entities/emergency-triage.entity';

export class CreateTriageCaseDto {
  @IsUUID()
  patientId: string;

  @IsString()
  chiefComplaint: string;

  @IsInt()
  @Min(1)
  @Max(5)
  acuityLevel: number;

  @IsOptional()
  @IsUUID()
  triagedBy?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateTriagePriorityDto {
  @IsInt()
  @Min(1)
  @Max(5)
  acuityLevel: number;

  @IsOptional()
  @IsEnum(TriageQueueStatus)
  queueStatus?: TriageQueueStatus;
}

export class CreateMonitoringRecordDto {
  @IsUUID()
  patientId: string;

  @IsString()
  metricType: string;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateResourceDto {
  @IsString()
  resourceType: string;

  @IsString()
  resourceName: string;

  @IsInt()
  @Min(0)
  totalUnits: number;

  @IsOptional()
  @IsString()
  location?: string;
}

export class UpdateResourceAllocationDto {
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  context?: string;
}

export class CreateRapidResponseDto {
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsString()
  eventType: string;

  @IsOptional()
  @IsUUID()
  teamLeadId?: string;

  @IsOptional()
  @IsArray()
  teamMembers?: Array<{ memberId: string; role?: string }>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRapidResponseStatusDto {
  @IsEnum(RapidResponseStatus)
  status: RapidResponseStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateEmergencyChartNoteDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  noteType?: string;

  @IsOptional()
  @IsString()
  encounterId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateDisasterIncidentDto {
  @IsString()
  incidentCode: string;

  @IsString()
  title: string;

  @IsString()
  incidentType: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  casualtyCount?: number;

  @IsOptional()
  @IsUUID()
  commandLeadId?: string;

  @IsOptional()
  @IsObject()
  triageSummary?: {
    immediate?: number;
    delayed?: number;
    minor?: number;
    expectant?: number;
  };

  @IsOptional()
  @IsObject()
  resourceSummary?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDisasterIncidentStatusDto {
  @IsEnum(DisasterIncidentStatus)
  status: DisasterIncidentStatus;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  casualtyCount?: number;

  @IsOptional()
  @IsObject()
  triageSummary?: {
    immediate?: number;
    delayed?: number;
    minor?: number;
    expectant?: number;
  };

  @IsOptional()
  @IsObject()
  resourceSummary?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}
