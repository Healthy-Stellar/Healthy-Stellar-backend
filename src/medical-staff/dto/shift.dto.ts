import { IsUUID, IsEnum, IsDateString, IsOptional, IsString } from 'class-validator';
import { ShiftRole } from '../entities/shift.entity';

export class CreateShiftDto {
  @IsUUID()
  staffId: string;

  @IsUUID()
  wardId: string;

  @IsEnum(ShiftRole)
  role: ShiftRole;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;
}

export class WeeklyScheduleQueryDto {
  /** ISO week start date, e.g. 2026-06-29 */
  @IsOptional()
  @IsString()
  week?: string;
}
