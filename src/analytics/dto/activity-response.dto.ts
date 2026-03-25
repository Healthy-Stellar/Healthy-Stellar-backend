import { IsString, IsNumber, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class DailyActivityDto {
  @IsString()
  date: string;

  @IsNumber()
  recordUploads: number;

  @IsNumber()
  accessEvents: number;
}

export class ActivityResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyActivityDto)
  dailyActivity: DailyActivityDto[];
}
