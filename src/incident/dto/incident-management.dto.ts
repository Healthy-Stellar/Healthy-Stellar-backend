import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentPriority, IncidentState } from '../entities/incident.entity';

export class CreateIncidentDto {
  @ApiProperty({ example: 'Payment service down' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: IncidentPriority })
  @IsEnum(IncidentPriority)
  priority: IncidentPriority;

  @ApiPropertyOptional({ description: 'User ID of the initial responder' })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class AcknowledgeIncidentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ResolveIncidentManagementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class IncidentManagementQueryDto {
  @ApiPropertyOptional({ enum: IncidentPriority })
  @IsOptional()
  @IsEnum(IncidentPriority)
  priority?: IncidentPriority;

  @ApiPropertyOptional({ enum: IncidentState })
  @IsOptional()
  @IsEnum(IncidentState)
  state?: IncidentState;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}

export class IncidentSlaReportQueryDto {
  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2024-12-31T23:59:59Z' })
  @IsDateString()
  to: string;
}
