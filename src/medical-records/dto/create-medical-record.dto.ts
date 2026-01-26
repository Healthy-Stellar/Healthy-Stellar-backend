import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsDateString,
  IsObject,
  IsNotEmpty,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecordType } from '../entities/medical-record.entity';

export class CreateMedicalRecordDto {
  @ApiProperty({
    description: 'Patient identifier (anonymized)',
    example: 'patient-12345-anon',
    pattern: '^[a-zA-Z0-9-]+$',
    minLength: 10,
    maxLength: 50
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 50)
  @Matches(/^[a-zA-Z0-9-]+$/, { message: 'Patient ID must be alphanumeric with hyphens only' })
  patientId: string;

  @ApiPropertyOptional({
    description: 'Healthcare provider identifier',
    example: 'provider-67890-anon',
    pattern: '^[a-zA-Z0-9-]+$'
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9-]+$/, { message: 'Provider ID must be alphanumeric with hyphens only' })
  providerId?: string;

  @ApiProperty({
    enum: RecordType,
    description: 'Medical record type following HL7 FHIR standards',
    example: RecordType.CONSULTATION,
    enumName: 'RecordType'
  })
  @IsEnum(RecordType)
  @IsNotEmpty()
  recordType: RecordType;

  @ApiPropertyOptional({
    description: 'Medical record title (PHI-compliant)',
    example: 'Annual Physical Examination',
    maxLength: 200
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Clinical notes and observations (encrypted)',
    example: 'Patient presents with routine annual examination. Vital signs within normal limits.',
    maxLength: 5000
  })
  @IsString()
  @IsOptional()
  @Length(1, 5000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Date of medical service (ISO 8601 format)',
    example: '2024-01-15T10:30:00Z',
    format: 'date-time'
  })
  @IsDateString()
  @IsOptional()
  recordDate?: string;

  @ApiPropertyOptional({
    description: 'Additional clinical metadata (FHIR-compliant)',
    example: {
      icd10Code: 'Z00.00',
      snomedCode: '410620009',
      facilityId: 'facility-001',
      departmentCode: 'INTERNAL_MED'
    },
    type: 'object'
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
