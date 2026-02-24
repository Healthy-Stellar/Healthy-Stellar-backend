import { IsString, IsUUID, IsEnum, IsOptional, IsDateString, IsNumber } from 'class-validator';
import { SpecimenType, FixativeType } from '../entities/pathology-specimen.entity';

export class CreateSpecimenDto {
  @IsUUID()
  pathologyCaseId: string;

  @IsEnum(SpecimenType)
  specimenType: SpecimenType;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  site?: string;

  @IsString()
  @IsOptional()
  containerType?: string;

  @IsEnum(FixativeType)
  @IsOptional()
  fixative?: FixativeType;

  @IsDateString()
  @IsOptional()
  collectionDate?: string;

  @IsNumber()
  @IsOptional()
  timeInFixativeHours?: number;

  @IsString()
  @IsOptional()
  processingProtocol?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
