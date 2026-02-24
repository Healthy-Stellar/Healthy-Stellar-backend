import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  IsNumber,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestCategory, SpecimenType, TestStatus } from '../entities/lab-test.entity';
import { ParameterDataType } from '../entities/lab-test-parameter.entity';

export class CreateLabTestParameterDto {
  @ApiProperty({
    description: 'Parameter name',
    example: 'White Blood Cell Count',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  parameterName: string;

  @ApiPropertyOptional({
    description: 'Parameter code',
    example: 'WBC',
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  parameterCode?: string;

  @ApiProperty({
    enum: ParameterDataType,
    description: 'Data type of the parameter',
    example: ParameterDataType.NUMERIC,
  })
  @IsEnum(ParameterDataType)
  dataType: ParameterDataType;

  @ApiPropertyOptional({
    description: 'Unit of measurement',
    example: '10^9/L',
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  unit?: string;

  @ApiPropertyOptional({
    description: 'Normal range low value',
    example: 4.0,
  })
  @IsNumber()
  @IsOptional()
  normalRangeLow?: number;

  @ApiPropertyOptional({
    description: 'Normal range high value',
    example: 11.0,
  })
  @IsNumber()
  @IsOptional()
  normalRangeHigh?: number;

  @ApiPropertyOptional({
    description: 'Critical low threshold',
    example: 2.0,
  })
  @IsNumber()
  @IsOptional()
  criticalLow?: number;

  @ApiPropertyOptional({
    description: 'Critical high threshold',
    example: 20.0,
  })
  @IsNumber()
  @IsOptional()
  criticalHigh?: number;

  @ApiPropertyOptional({
    description: 'Age and gender-specific reference ranges',
    example: [
      {
        ageMin: 18,
        ageMax: 65,
        gender: 'male',
        normalLow: 4.5,
        normalHigh: 11.0,
      },
    ],
  })
  @IsOptional()
  referenceRanges?: Array<{
    ageMin?: number;
    ageMax?: number;
    gender?: 'male' | 'female' | 'other';
    normalLow?: number;
    normalHigh?: number;
    criticalLow?: number;
    criticalHigh?: number;
    unit?: string;
  }>;

  @ApiPropertyOptional({
    description: 'Display order',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  displayOrder?: number;
}

export class CreateLabTestDto {
  @ApiProperty({
    description: 'Unique test code',
    example: 'CBC',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  testCode: string;

  @ApiProperty({
    description: 'Test name',
    example: 'Complete Blood Count',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  testName: string;

  @ApiPropertyOptional({
    description: 'Test description',
    example: 'Comprehensive blood panel measuring various blood components',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: TestCategory,
    description: 'Test category',
    example: TestCategory.HEMATOLOGY,
  })
  @IsEnum(TestCategory)
  category: TestCategory;

  @ApiProperty({
    enum: SpecimenType,
    description: 'Required specimen type',
    example: SpecimenType.BLOOD,
  })
  @IsEnum(SpecimenType)
  specimenType: SpecimenType;

  @ApiPropertyOptional({
    description: 'LOINC code',
    example: '58410-2',
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  loincCode?: string;

  @ApiPropertyOptional({
    description: 'CPT code',
    example: '85025',
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  cptCode?: string;

  @ApiPropertyOptional({
    description: 'Turnaround time in hours',
    example: 24,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  turnaroundTime?: number;

  @ApiPropertyOptional({
    description: 'Test cost',
    example: 45.0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({
    enum: TestStatus,
    description: 'Test status',
    example: TestStatus.ACTIVE,
  })
  @IsEnum(TestStatus)
  @IsOptional()
  status?: TestStatus;

  @ApiPropertyOptional({
    description: 'Special instructions for the test',
  })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiPropertyOptional({
    description: 'Test parameters',
    type: [CreateLabTestParameterDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateLabTestParameterDto)
  parameters?: CreateLabTestParameterDto[];

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
