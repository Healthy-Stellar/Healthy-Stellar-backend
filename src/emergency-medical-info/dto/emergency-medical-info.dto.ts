import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BloodType } from '../entities/emergency-medical-info.entity';

class EmergencyContactDto {
  @IsString() name: string;
  @IsString() relationship: string;
  @IsString() phone: string;
}

export class CreateEmergencyMedicalInfoDto {
  @IsUUID()
  patientId: string;

  @IsOptional() @IsEnum(BloodType)
  bloodType?: BloodType;

  @IsOptional() @IsArray() @IsString({ each: true })
  allergies?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  currentMedications?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  chronicConditions?: string[];

  @IsOptional() @IsBoolean()
  dnrStatus?: boolean;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EmergencyContactDto)
  emergencyContacts?: EmergencyContactDto[];

  @IsOptional() @IsString()
  insuranceInfo?: string;

  @IsOptional() @IsString()
  additionalNotes?: string;
}

export class UpdateEmergencyMedicalInfoDto {
  @IsOptional() @IsEnum(BloodType)
  bloodType?: BloodType;

  @IsOptional() @IsArray() @IsString({ each: true })
  allergies?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  currentMedications?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  chronicConditions?: string[];

  @IsOptional() @IsBoolean()
  dnrStatus?: boolean;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EmergencyContactDto)
  emergencyContacts?: EmergencyContactDto[];

  @IsOptional() @IsString()
  insuranceInfo?: string;

  @IsOptional() @IsString()
  additionalNotes?: string;
}
