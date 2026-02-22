import { IsEnum, IsString, IsOptional, IsUUID, IsObject } from 'class-validator';
import { AlertType, AlertPriority } from '../entities/clinical-alert.entity';

export class CreateAlertDto {
  @IsEnum(AlertType)
  alertType: AlertType;

  @IsEnum(AlertPriority)
  priority: AlertPriority;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @IsOptional()
  @IsObject()
  alertData?: Record<string, any>;
}