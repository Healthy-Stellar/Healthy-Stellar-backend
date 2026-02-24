import { IsString, IsUUID, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { MolecularTestType } from '../entities/molecular-test.entity';

export class CreateMolecularTestDto {
  @IsUUID()
  pathologyCaseId: string;

  @IsEnum(MolecularTestType)
  testType: MolecularTestType;

  @IsString()
  testName: string;

  @IsString()
  @IsOptional()
  geneMarker?: string;

  @IsString()
  methodology: string;

  @IsString()
  specimenType: string;

  @IsString()
  indication: string;

  @IsDateString()
  @IsOptional()
  orderedDate?: string;

  @IsString()
  @IsOptional()
  externalLab?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateMolecularTestResultDto {
  @IsString()
  result: string;

  @IsString()
  @IsOptional()
  interpretation?: string;

  @IsOptional()
  referenceRanges?: Record<string, any>;

  @IsUUID()
  @IsOptional()
  technologistId?: string;

  @IsString()
  @IsOptional()
  technologistName?: string;

  @IsUUID()
  @IsOptional()
  reviewingPathologistId?: string;

  @IsString()
  @IsOptional()
  reviewingPathologistName?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
