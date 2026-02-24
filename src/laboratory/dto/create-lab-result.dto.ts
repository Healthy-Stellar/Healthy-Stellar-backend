import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResultStatus } from '../entities/lab-result.entity';

export class CreateLabResultValueDto {
  @ApiProperty({
    description: 'Lab test parameter ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  parameterId: string;

  @ApiProperty({
    description: 'Result value',
    example: '7.5',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  resultValue: string;

  @ApiPropertyOptional({
    description: 'Numeric value (if applicable)',
    example: 7.5,
  })
  @IsNumber()
  @IsOptional()
  numericValue?: number;

  @ApiPropertyOptional({
    description: 'Unit of measurement',
    example: '10^9/L',
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  unit?: string;

  @ApiPropertyOptional({
    description: 'Notes for this result value',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateLabResultDto {
  @ApiProperty({
    description: 'Lab order item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  orderItemId: string;

  @ApiPropertyOptional({
    enum: ResultStatus,
    description: 'Result status',
    example: ResultStatus.PRELIMINARY,
  })
  @IsEnum(ResultStatus)
  @IsOptional()
  status?: ResultStatus;

  @ApiPropertyOptional({
    description: 'Performed date (ISO 8601 format)',
    example: '2024-01-26T14:30:00Z',
  })
  @IsDateString()
  @IsOptional()
  performedDate?: string;

  @ApiProperty({
    description: 'User ID of person who performed the test',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsNotEmpty()
  performedBy: string;

  @ApiPropertyOptional({
    description: 'Name of person who performed the test',
    example: 'Lab Tech Smith',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  performedByName?: string;

  @ApiPropertyOptional({
    description: 'Result notes',
  })
  @IsString()
  @IsOptional()
  resultNotes?: string;

  @ApiPropertyOptional({
    description: 'Clinical interpretation',
  })
  @IsString()
  @IsOptional()
  interpretation?: string;

  @ApiPropertyOptional({
    description: 'Instrument ID',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  instrumentId?: string;

  @ApiPropertyOptional({
    description: 'Instrument name',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  instrumentName?: string;

  @ApiPropertyOptional({
    description: 'Method ID',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  methodId?: string;

  @ApiPropertyOptional({
    description: 'Method name',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  methodName?: string;

  @ApiProperty({
    description: 'Result values for each parameter',
    type: [CreateLabResultValueDto],
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateLabResultValueDto)
  values: CreateLabResultValueDto[];

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
