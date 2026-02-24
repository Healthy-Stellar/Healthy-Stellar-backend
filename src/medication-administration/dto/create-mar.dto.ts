import {
  IsUUID,
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsBoolean,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdministrationRoute } from '../entities/medication-administration-record.entity';

export class CreateMarDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  prescriptionId: string;

  @IsUUID()
  medicationId: string;

  @IsString()
  @Length(1, 255)
  medicationName: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  medicationBarcode?: string;

  @IsString()
  @Length(1, 100)
  dosage: string;

  @IsEnum(AdministrationRoute)
  route: AdministrationRoute;

  @IsDateString()
  scheduledTime: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  siteOfAdministration?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  lotNumber?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsBoolean()
  isPrn?: boolean;

  @IsOptional()
  @IsString()
  prnReason?: string;

  @IsOptional()
  @IsBoolean()
  isHighAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresWitness?: boolean;

  @IsOptional()
  @IsString()
  administrationNotes?: string;
}
