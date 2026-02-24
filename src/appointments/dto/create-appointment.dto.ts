import {
  IsString,
  IsEnum,
  IsDateString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { AppointmentType, MedicalPriority } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @IsString()
  patientId: string;

  @IsString()
  doctorId: string;

  @IsDateString()
  appointmentDate: string;

  @IsNumber()
  @Min(15)
  @Max(240)
  duration: number;

  @IsEnum(AppointmentType)
  type: AppointmentType;

  @IsEnum(MedicalPriority)
  priority: MedicalPriority;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isTelemedicine?: boolean;
}
