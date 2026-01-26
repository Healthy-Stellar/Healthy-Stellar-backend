export class CreateScheduleDto {
  @IsString()
  doctorId: string;

  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsString()
  startTime: string; // Format: HH:mm

  @IsString()
  endTime: string; // Format: HH:mm

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveUntil?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}