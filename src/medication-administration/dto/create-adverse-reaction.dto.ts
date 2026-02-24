import { IsUUID, IsString, IsEnum, IsDateString, IsOptional, IsBoolean } from 'class-validator';
import { ReactionSeverity, ReactionType } from '../entities/adverse-drug-reaction.entity';

export class CreateAdverseReactionDto {
  @IsOptional()
  @IsUUID()
  marId?: string;

  @IsUUID()
  patientId: string;

  @IsString()
  medicationName: string;

  @IsOptional()
  @IsUUID()
  medicationId?: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsDateString()
  reactionDate: string;

  @IsEnum(ReactionSeverity)
  severity: ReactionSeverity;

  @IsEnum(ReactionType)
  reactionType: ReactionType;

  @IsString()
  symptoms: string;

  @IsOptional()
  @IsString()
  onsetTime?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  treatmentGiven?: string;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsUUID()
  reporterId: string;

  @IsString()
  reporterName: string;

  @IsString()
  reporterRole: string;

  @IsOptional()
  @IsString()
  concomitantMedications?: string;

  @IsOptional()
  @IsString()
  medicalHistoryRelevant?: string;

  @IsOptional()
  @IsString()
  labValues?: string;

  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
