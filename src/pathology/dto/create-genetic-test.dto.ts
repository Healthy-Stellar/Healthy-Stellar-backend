import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ACMGClassification, InheritancePattern } from '../entities/genetic-test.entity';

export class CreateGeneticTestDto {
  @IsUUID()
  pathologyCaseId: string;

  @IsString()
  testPanelName: string;

  @IsArray()
  genesAnalyzed: string[];

  @IsBoolean()
  @IsOptional()
  consentDocumented?: boolean;

  @IsString()
  @IsOptional()
  consentFormPath?: string;

  @IsDateString()
  @IsOptional()
  orderedDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateGeneticTestResultDto {
  @IsArray()
  @IsOptional()
  variantsDetected?: Array<{
    gene: string;
    variant: string;
    zygosity: string;
    classification: ACMGClassification;
  }>;

  @IsEnum(ACMGClassification)
  @IsOptional()
  overallClassification?: ACMGClassification;

  @IsString()
  @IsOptional()
  clinicalSignificance?: string;

  @IsEnum(InheritancePattern)
  @IsOptional()
  inheritancePattern?: InheritancePattern;

  @IsString()
  @IsOptional()
  recommendations?: string;

  @IsString()
  @IsOptional()
  geneticCounselorNotes?: string;

  @IsUUID()
  @IsOptional()
  reviewingGeneticistId?: string;

  @IsString()
  @IsOptional()
  reviewingGeneticistName?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
