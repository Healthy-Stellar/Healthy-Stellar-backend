import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JoinWaitlistDto {
  @ApiProperty({ description: 'Doctor/provider UUID' })
  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ description: 'Earliest acceptable appointment date (ISO 8601)' })
  @IsDateString()
  preferredDateStart: string;

  @ApiProperty({ description: 'Latest acceptable appointment date (ISO 8601)' })
  @IsDateString()
  preferredDateEnd: string;

  @ApiPropertyOptional({ description: 'Minutes to respond to a slot offer before it expires', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  responseWindowMinutes?: number;
}
