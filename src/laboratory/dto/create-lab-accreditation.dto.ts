import { IsString, IsEnum, IsDateString, IsOptional, IsObject, IsNumber } from 'class-validator';
import { AccreditationType } from '../entities/lab-accreditation.entity';

export class CreateLabAccreditationDto {
  @IsEnum(AccreditationType)
  type: AccreditationType;

  @IsString()
  accreditationBody: string;

  @IsString()
  certificateNumber: string;

  @IsDateString()
  issuedDate: string;

  @IsDateString()
  expiryDate: string;

  @IsString()
  scopeOfAccreditation: string;

  @IsOptional()
  @IsString()
  certificateFilePath?: string;

  @IsOptional()
  @IsDateString()
  nextAssessmentDate?: string;

  @IsOptional()
  @IsNumber()
  assessmentFrequency?: number;

  @IsOptional()
  @IsObject()
  requirements?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}
