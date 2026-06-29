import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHandoffDto {
  @ApiProperty({ description: 'Provider handing off the patient' })
  @IsUUID()
  fromProvider: string;

  @ApiProperty({ description: 'Provider receiving the patient' })
  @IsUUID()
  toProvider: string;

  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({ description: 'Clinical summary of the handoff' })
  @IsString()
  summary: string;

  @ApiPropertyOptional({ type: [String], description: 'Outstanding tasks for the receiving provider' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pendingTasks?: string[];

  @ApiPropertyOptional({ description: 'ISO-8601 handoff time; defaults to now' })
  @IsOptional()
  @IsDateString()
  handoffTime?: string;
}

export class HandoffQueryDto {
  @ApiPropertyOptional({ description: 'Filter by patient' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Filter by receiving provider' })
  @IsOptional()
  @IsUUID()
  toProvider?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}
