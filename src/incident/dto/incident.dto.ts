import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentSeverity, IncidentStatus } from '../entities/incident-evidence.entity';

export class CaptureIncidentDto {
  @ApiProperty({ example: 'High RSS on worker-2 during report burst' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: IncidentSeverity, default: IncidentSeverity.HIGH })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Operator ID or automated rule name' })
  @IsOptional()
  @IsString()
  triggeredBy?: string;

  @ApiPropertyOptional({ description: 'Arbitrary key/value context (job IDs, queue names, etc.)' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ResolveIncidentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateIncidentNotesDto {
  @ApiProperty()
  @IsString()
  notes: string;
}

export class IncidentQueryDto {
  @ApiPropertyOptional({ enum: IncidentSeverity })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiPropertyOptional({ enum: IncidentStatus })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}
