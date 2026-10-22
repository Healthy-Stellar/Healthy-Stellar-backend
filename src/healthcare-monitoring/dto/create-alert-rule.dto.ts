import {
  IsUUID,
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertPriority } from '../entities/clinical-alert.entity';
import { AlertOperator, VALID_METRIC_NAMES } from '../entities/alert-rule.entity';

export class CreateAlertRuleDto {
  @ApiProperty({ description: 'Patient UUID this rule applies to' })
  @IsUUID()
  patientId: string;

  @ApiProperty({
    description: 'Vital metric name to monitor',
    enum: VALID_METRIC_NAMES,
    example: 'heartRate',
  })
  @IsString()
  @IsIn([...VALID_METRIC_NAMES])
  metricName: string;

  @ApiProperty({
    description: 'Comparison operator',
    enum: AlertOperator,
    example: AlertOperator.GT,
  })
  @IsEnum(AlertOperator)
  operator: AlertOperator;

  @ApiProperty({ description: 'Threshold value to compare the metric against', example: 120 })
  @IsNumber()
  threshold: number;

  @ApiProperty({
    description: 'Alert priority when this rule fires',
    enum: AlertPriority,
    example: AlertPriority.HIGH,
  })
  @IsEnum(AlertPriority)
  priority: AlertPriority;

  @ApiProperty({ description: 'Human-readable rule name', maxLength: 200, example: 'High Heart Rate' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Optional description of the clinical intent' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the rule is active (default: true)', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
