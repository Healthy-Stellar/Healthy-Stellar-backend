import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsDateString,
  IsObject,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordType } from '../entities/medical-record.entity';

export class CreateMedicalRecordDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({ description: 'Provider ID' })
  @IsUUID()
  @IsOptional()
  providerId?: string;

  @ApiProperty({ enum: RecordType, description: 'Type of medical record' })
  @IsEnum(RecordType)
  @IsNotEmpty()
  recordType: RecordType;

  @ApiPropertyOptional({ description: 'Record title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Record description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Date of the medical record' })
  @IsDateString()
  @IsOptional()
  recordDate?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
