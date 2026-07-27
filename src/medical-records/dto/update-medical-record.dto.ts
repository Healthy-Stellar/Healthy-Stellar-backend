import { IsString, IsEnum, IsOptional, IsDateString, IsObject, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecordType, MedicalRecordStatus } from '../entities/medical-record.entity';

export class UpdateMedicalRecordDto {
  @ApiPropertyOptional({ enum: RecordType })
  @IsEnum(RecordType)
  @IsOptional()
  recordType?: RecordType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: MedicalRecordStatus })
  @IsEnum(MedicalRecordStatus)
  @IsOptional()
  status?: MedicalRecordStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  recordDate?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Current version of the record for optimistic locking. Required to prevent concurrent update conflicts.',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  expectedVersion?: number;
}
