import { IsUUID, IsString, IsEnum, IsDateString, IsOptional, IsBoolean } from 'class-validator';
import { AdministrationStatus } from '../entities/medication-administration-record.entity';

export class AdministerMedicationDto {
  @IsUUID()
  marId: string;

  @IsUUID()
  nurseId: string;

  @IsString()
  nurseName: string;

  @IsOptional()
  @IsUUID()
  witnessId?: string;

  @IsOptional()
  @IsString()
  witnessName?: string;

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
