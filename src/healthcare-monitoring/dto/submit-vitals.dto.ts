import {
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitVitalsDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional({ description: 'Heart rate in bpm', minimum: 0, maximum: 300 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Systolic blood pressure in mmHg', minimum: 0, maximum: 300 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  systolicBp?: number;

  @ApiPropertyOptional({ description: 'Diastolic blood pressure in mmHg', minimum: 0, maximum: 200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  diastolicBp?: number;

  @ApiPropertyOptional({ description: 'Oxygen saturation percentage (SpO2)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  oxygenSaturation?: number;

  @ApiPropertyOptional({ description: 'Body temperature in Celsius', minimum: 20, maximum: 45 })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(45)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Respiratory rate in breaths/min', minimum: 0, maximum: 60 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  respiratoryRate?: number;

  @ApiPropertyOptional({ description: 'Blood glucose in mg/dL', minimum: 0, maximum: 600 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(600)
  bloodGlucose?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
