import { IsString, IsUUID, IsEnum, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { StainType, SlideQuality } from '../entities/histology-slide.entity';

export class CreateHistologySlideDto {
  @IsUUID()
  pathologyCaseId: string;

  @IsString()
  @IsOptional()
  specimenId?: string;

  @IsString()
  blockNumber: string;

  @IsNumber()
  @IsOptional()
  sectionNumber?: number;

  @IsEnum(StainType)
  stainType: StainType;

  @IsString()
  @IsOptional()
  ihcMarker?: string;

  @IsUUID()
  @IsOptional()
  technicianId?: string;

  @IsString()
  @IsOptional()
  technicianName?: string;

  @IsEnum(SlideQuality)
  @IsOptional()
  quality?: SlideQuality;

  @IsBoolean()
  @IsOptional()
  recutRequired?: boolean;

  @IsString()
  @IsOptional()
  recutReason?: string;

  @IsNumber()
  @IsOptional()
  thicknessMicrons?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
