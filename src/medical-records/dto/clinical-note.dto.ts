import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ClinicalNoteType } from '../entities/clinical-note.entity';

export class CreateClinicalNoteDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;

  @ApiPropertyOptional({ enum: ClinicalNoteType, default: ClinicalNoteType.PROGRESS })
  @IsOptional()
  @IsEnum(ClinicalNoteType)
  noteType?: ClinicalNoteType;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  noteContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  encounterDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}

export class UpdateClinicalNoteDto extends PartialType(CreateClinicalNoteDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}

export class SignClinicalNoteDto {
  @ApiProperty()
  @IsUUID()
  signedBy: string;
}

export class SearchClinicalNotesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;

  @ApiPropertyOptional({ enum: ClinicalNoteType })
  @IsOptional()
  @IsEnum(ClinicalNoteType)
  noteType?: ClinicalNoteType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSigned?: boolean;
}
