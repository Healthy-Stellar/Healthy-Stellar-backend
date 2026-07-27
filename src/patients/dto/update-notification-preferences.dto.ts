import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional } from 'class-validator';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  WEBSOCKET = 'WEBSOCKET',
  SMS = 'SMS',
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  newRecord?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  accessGranted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  accessRevoked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  appointmentReminder?: boolean;

  @ApiPropertyOptional({ enum: NotificationChannel, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];
}
