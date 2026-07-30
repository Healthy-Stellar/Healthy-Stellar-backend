import {
  IsString,
  IsEnum,
  IsDateString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsNotEmpty,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { AppointmentType, MedicalPriority } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsNotEmpty()
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
  @MaxLength(100)
  specialty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isTelemedicine?: boolean;

  /**
   * Optional physical room id for in-person appointments. Two appointments
   * sharing the same `roomId` whose time windows (with the configured
   * `APPOINTMENT_BUFFER_MINUTES` cleanup gap expanded on both sides) overlap
   * will produce a 409 Conflict — see
   * `AppointmentService.create()`.
   *
   * Telemedicine sessions auto-generate a unique room id internally; do not
   * pass `roomId` together with `isTelemedicine: true` — the appointment
   * conflicts to detect are provider-side, not room-side, in that case.
   */
  @IsOptional()
  @IsUUID()
  roomId?: string;
}
