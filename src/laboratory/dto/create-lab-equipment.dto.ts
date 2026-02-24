import { IsString, IsEnum, IsOptional, IsDateString, IsObject, IsBoolean } from 'class-validator';
import { EquipmentType } from '../entities/lab-equipment.entity';

export class CreateLabEquipmentDto {
  @IsString()
  name: string;

  @IsString()
  model: string;

  @IsString()
  manufacturer: string;

  @IsString()
  serialNumber: string;

  @IsEnum(EquipmentType)
  type: EquipmentType;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  installationDate?: string;

  @IsOptional()
  @IsDateString()
  lastMaintenanceDate?: string;

  @IsOptional()
  @IsDateString()
  nextMaintenanceDate?: string;

  @IsOptional()
  @IsDateString()
  lastCalibrationDate?: string;

  @IsOptional()
  @IsDateString()
  nextCalibrationDate?: string;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, any>;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isAutomated?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsLisIntegration?: boolean;
}
