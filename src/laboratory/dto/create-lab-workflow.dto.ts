import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowPriority } from '../entities/lab-workflow.entity';
import { CreateLabWorkflowStepDto } from './create-lab-workflow-step.dto';

export class CreateLabWorkflowDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(WorkflowPriority)
  priority: WorkflowPriority;

  @IsUUID()
  labOrderId: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsNumber()
  estimatedDuration?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLabWorkflowStepDto)
  steps?: CreateLabWorkflowStepDto[];
}
