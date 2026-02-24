import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsArray,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QCType, QCResult } from '../entities/quality-control-log.entity';

export class CreateQualityControlDto {
  @ApiProperty({
    enum: QCType,
    description: 'QC type',
    example: QCType.CALIBRATION,
  })
  @IsEnum(QCType)
  @IsNotEmpty()
  qcType: QCType;

  @ApiProperty({
    description: 'Equipment ID',
    example: 'HEMA-001',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  equipmentId: string;

  @ApiProperty({
    description: 'Equipment name',
    example: 'Hematology Analyzer XYZ-2000',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  equipmentName: string;

  @ApiPropertyOptional({
    description: 'Lab test ID',
  })
  @IsUUID()
  @IsOptional()
  labTestId?: string;

  @ApiPropertyOptional({
    description: 'Lab test name',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  labTestName?: string;

  @ApiPropertyOptional({
    description: 'QC date (ISO 8601 format)',
    example: '2024-01-26T09:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  qcDate?: string;

  @ApiProperty({
    description: 'User ID of person who performed QC',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  performedBy: string;

  @ApiPropertyOptional({
    description: 'Name of person who performed QC',
    example: 'Lab Supervisor Johnson',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  performedByName?: string;

  @ApiProperty({
    enum: QCResult,
    description: 'QC result',
    example: QCResult.PASS,
  })
  @IsEnum(QCResult)
  @IsNotEmpty()
  qcResult: QCResult;

  @ApiPropertyOptional({
    description: 'QC values with control levels',
    example: [
      {
        controlLevel: 'Level 1',
        expectedValue: 7.5,
        measuredValue: 7.4,
        unit: '10^9/L',
        acceptableRange: '6.8-8.2',
        isWithinRange: true,
      },
    ],
  })
  @IsArray()
  @IsOptional()
  qcValues?: Array<{
    controlLevel: string;
    expectedValue?: number;
    measuredValue?: number;
    unit?: string;
    acceptableRange?: string;
    isWithinRange?: boolean;
  }>;

  @ApiPropertyOptional({
    description: 'Lot number',
    example: 'LOT-2024-001',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  lotNumber?: string;

  @ApiPropertyOptional({
    description: 'Expiration date (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  expirationDate?: string;

  @ApiPropertyOptional({
    description: 'Corrective actions taken',
  })
  @IsString()
  @IsOptional()
  correctiveActions?: string;

  @ApiPropertyOptional({
    description: 'Next due date (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  nextDueDate?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
