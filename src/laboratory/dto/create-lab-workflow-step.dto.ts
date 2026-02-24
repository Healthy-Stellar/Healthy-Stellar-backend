import { IsString, IsEnum, IsOptional, IsNumber, IsObject } from 'class-validator';
import { StepType } from '../entities/lab-workflow-step.entity';

export class CreateLabWorkflowStepDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(StepType)
  type: StepType;

  @IsNumber()
  stepOrder: number;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  equipmentId?: string;

  @IsOptional()
  @IsNumber()
  estimatedDuration?: number;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}
