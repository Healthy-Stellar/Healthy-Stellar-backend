import { IsUUID, IsString, IsEnum, IsDateString, IsOptional, IsBoolean } from 'class-validator';
import { AdministrationStatus } from '../entities/medication-administration-record.entity';

export class AdministerMedicationDto {
  @IsUUID()
  marId: string;

  @IsOptional()
  @IsUUID()
  witnessId?: string;

  @IsDateString()
  administrationTime: string;

  @IsEnum(AdministrationStatus)
  status: AdministrationStatus;

  @IsOptional()
  @IsString()
  administrationNotes?: string;

  @IsOptional()
  @IsString()
  refusalReason?: string;

  @IsOptional()
  @IsString()
  holdReason?: string;

  @IsOptional()
  @IsString()
  siteOfAdministration?: string;

  @IsOptional()
  @IsString()
  prnReason?: string;

  @IsBoolean()
  barcodeVerified: boolean;

  @IsBoolean()
  patientVerified: boolean;

  @IsBoolean()
  medicationVerified: boolean;

  @IsBoolean()
  doseVerified: boolean;

  @IsBoolean()
  routeVerified: boolean;

  @IsBoolean()
  timeVerified: boolean;
}