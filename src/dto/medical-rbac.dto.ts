import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuditAction, MedicalDepartment } from '../roles/medical-roles.enum';

export class EmergencyOverrideRequestDto {
  @IsUUID()
  patientId: string;

  @IsString()
  reason: string;
}

export class ReviewEmergencyOverrideDto {
  @IsUUID()
  overrideId: string;

  @IsString()
  reviewNotes: string;
}

export class QueryAuditLogsDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsEnum(MedicalDepartment)
  department?: MedicalDepartment;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  emergencyOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
