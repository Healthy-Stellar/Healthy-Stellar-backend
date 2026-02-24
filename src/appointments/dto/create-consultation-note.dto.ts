import { IsString, IsEnum, IsOptional, IsBoolean, IsDateString, IsObject } from 'class-validator';
import { ConsultationOutcome } from '../entities/consultation-note.entity';

export class CreateConsultationNoteDto {
  @IsString()
  appointmentId: string;

  @IsString()
  doctorId: string;

  @IsString()
  symptoms: string;

  @IsString()
  diagnosis: string;

  @IsOptional()
  @IsString()
  treatment?: string;

  @IsOptional()
  @IsString()
  prescription?: string;

  @IsEnum(ConsultationOutcome)
  outcome: ConsultationOutcome;

  @IsOptional()
  @IsString()
  recommendations?: string;

  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsOptional()
  @IsString()
  referredTo?: string;

  @IsOptional()
  @IsObject()
  vitals?: Record<string, any>;
}
