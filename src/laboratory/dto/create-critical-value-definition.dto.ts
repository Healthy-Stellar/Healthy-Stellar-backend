import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CriticalSeverity } from '../entities/critical-value-definition.entity';

export class CreateCriticalValueDefinitionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  testCode: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  testName: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  criticalLow?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  criticalHigh?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({ enum: CriticalSeverity })
  @IsEnum(CriticalSeverity)
  @IsOptional()
  severity?: CriticalSeverity;
}
