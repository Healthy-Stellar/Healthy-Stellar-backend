import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsObject,
  IsUUID,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ConsultationOutcome } from '../entities/consultation-note.entity';

export class CreateConsultationNoteDto {
  @IsUUID()
  @IsNotEmpty()
  appointmentId: string;

  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  symptoms: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  diagnosis: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  treatment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prescription?: string;

  @IsEnum(ConsultationOutcome)
  outcome: ConsultationOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendations?: string;

  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsOptional()
  @IsUUID()
  referredTo?: string;

  @IsOptional()
  @IsObject()
  vitals?: Record<string, number | string>;
}
