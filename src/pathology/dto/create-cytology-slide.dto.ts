import { IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';
import {
  CytologySpecimenType,
  PreparationMethod,
  AdequacyStatus,
  BethesdaClassification,
} from '../entities/cytology-slide.entity';

export class CreateCytologySlideDto {
  @IsUUID()
  pathologyCaseId: string;

  @IsEnum(CytologySpecimenType)
  specimenType: CytologySpecimenType;

  @IsEnum(PreparationMethod)
  preparationMethod: PreparationMethod;

  @IsEnum(AdequacyStatus)
  adequacy: AdequacyStatus;

  @IsString()
  @IsOptional()
  adequacyComment?: string;

  @IsEnum(BethesdaClassification)
  @IsOptional()
  bethesdaClassification?: BethesdaClassification;

  @IsUUID()
  @IsOptional()
  screeningCytotechId?: string;

  @IsString()
  @IsOptional()
  screeningCytotechName?: string;

  @IsString()
  @IsOptional()
  findings?: string;

  @IsString()
  @IsOptional()
  interpretation?: string;

  @IsString()
  @IsOptional()
  recommendation?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
