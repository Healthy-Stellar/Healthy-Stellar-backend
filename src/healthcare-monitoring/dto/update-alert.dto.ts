import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertStatus } from '../entities/clinical-alert.entity';

const ALLOWED_STATUSES = [AlertStatus.ACKNOWLEDGED, AlertStatus.RESOLVED] as const;

export class UpdateAlertDto {
  @ApiProperty({
    description: 'Transition the alert to acknowledged or resolved',
    enum: ALLOWED_STATUSES,
    example: AlertStatus.ACKNOWLEDGED,
  })
  @IsEnum(AlertStatus)
  status: AlertStatus.ACKNOWLEDGED | AlertStatus.RESOLVED;

  @ApiPropertyOptional({ description: 'Resolution notes, recommended when resolving' })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
