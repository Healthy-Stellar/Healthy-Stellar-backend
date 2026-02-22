import { IsEnum, IsString, IsOptional, IsUUID, IsArray, IsBoolean } from 'class-validator';
import { IncidentType, IncidentSeverity } from '../entities/healthcare-incident.entity';

export class CreateIncidentDto {
  @IsEnum(IncidentType)
  incidentType: IncidentType;

  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  department: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @IsUUID()
  reportedBy: string;

  @IsOptional()
  @IsArray()
  witnesses?: Record<string, any>[];

  @IsOptional()
  @IsArray()
  attachments?: string[];

  @IsOptional()
  @IsBoolean()
  requiresRegulatoryCommunication?: boolean;

  @IsOptional()
  @IsArray()
  regulatoryBodies?: string[];
}