import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RunbookCategory, RunbookStatus, RunbookStep } from '../entities/runbook.entity';

export class RunbookStepDto implements Partial<RunbookStep> {
  @ApiProperty()
  @IsInt()
  @Min(1)
  stepNumber: number;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  command?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectedOutcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rollbackCommand?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  requiresConfirmation: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutSeconds?: number;
}

export class CreateRunbookDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ enum: RunbookCategory })
  @IsEnum(RunbookCategory)
  category: RunbookCategory;

  @ApiProperty({ type: [RunbookStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RunbookStepDto)
  steps: RunbookStepDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rollbackProcedure?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredRoles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresDualApproval?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateRunbookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: RunbookCategory })
  @IsOptional()
  @IsEnum(RunbookCategory)
  category?: RunbookCategory;

  @ApiPropertyOptional({ enum: RunbookStatus })
  @IsOptional()
  @IsEnum(RunbookStatus)
  status?: RunbookStatus;

  @ApiPropertyOptional({ type: [RunbookStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RunbookStepDto)
  steps?: RunbookStepDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rollbackProcedure?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredRoles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresDualApproval?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class InitiateExecutionDto {
  @ApiProperty({ description: 'Reason for executing this runbook' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Additional context or parameters for execution' })
  @IsOptional()
  @IsObject()
  context?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Run in dry-run mode without applying changes', default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveExecutionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordStepResultDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  stepNumber: number;

  @ApiProperty({ enum: ['success', 'failed', 'skipped'] })
  @IsEnum(['success', 'failed', 'skipped'])
  status: 'success' | 'failed' | 'skipped';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  output?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error?: string;
}

export class CompleteExecutionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelExecutionDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class RunbookQueryDto {
  @ApiPropertyOptional({ enum: RunbookCategory })
  @IsOptional()
  @IsEnum(RunbookCategory)
  category?: RunbookCategory;

  @ApiPropertyOptional({ enum: RunbookStatus })
  @IsOptional()
  @IsEnum(RunbookStatus)
  status?: RunbookStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
