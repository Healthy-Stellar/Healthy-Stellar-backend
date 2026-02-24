import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsObject,
  IsNotEmpty,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TemplateCategory {
  ASSESSMENT = 'ASSESSMENT',
  PLAN = 'PLAN',
  PROGRESS_NOTE = 'PROGRESS_NOTE',
  DISCHARGE_SUMMARY = 'DISCHARGE_SUMMARY',
  CONSULTATION = 'CONSULTATION',
  PROCEDURE_NOTE = 'PROCEDURE_NOTE',
}

export class TemplateField {
  @ApiProperty({
    description: 'Field identifier (FHIR-compatible)',
    example: 'chief_complaint',
    pattern: '^[a-z_]+$',
  })
  @IsString()
  @IsNotEmpty()
  fieldId: string;

  @ApiProperty({
    description: 'Human-readable field label',
    example: 'Chief Complaint',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  label: string;

  @ApiProperty({
    description: 'Field data type',
    enum: ['text', 'number', 'date', 'select', 'multiselect', 'boolean'],
    example: 'text',
  })
  @IsEnum(['text', 'number', 'date', 'select', 'multiselect', 'boolean'])
  fieldType: string;

  @ApiPropertyOptional({
    description: 'Field validation rules',
    example: { required: true, maxLength: 500 },
  })
  @IsObject()
  @IsOptional()
  validation?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Default field value',
    example: 'Patient reports...',
  })
  @IsOptional()
  defaultValue?: any;
}

export class CreateClinicalTemplateDto {
  @ApiProperty({
    description: 'Template name (medical standard compliant)',
    example: 'Internal Medicine Consultation Template',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({
    description: 'Template description and usage guidelines',
    example:
      'Standardized template for internal medicine consultations following HL7 FHIR guidelines',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @Length(1, 1000)
  description?: string;

  @ApiProperty({
    enum: TemplateCategory,
    description: 'Clinical template category (HL7 document types)',
    example: TemplateCategory.CONSULTATION,
    enumName: 'TemplateCategory',
  })
  @IsEnum(TemplateCategory)
  @IsNotEmpty()
  category: TemplateCategory;

  @ApiProperty({
    type: [TemplateField],
    description: 'Template field definitions (FHIR-compatible structure)',
    example: [
      {
        fieldId: 'chief_complaint',
        label: 'Chief Complaint',
        fieldType: 'text',
        validation: { required: true, maxLength: 500 },
      },
      {
        fieldId: 'history_present_illness',
        label: 'History of Present Illness',
        fieldType: 'text',
        validation: { required: true, maxLength: 2000 },
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateField)
  @IsNotEmpty()
  fields: TemplateField[];

  @ApiPropertyOptional({
    description: 'Medical coding standards used (ICD-10, SNOMED CT, CPT)',
    example: ['ICD-10', 'SNOMED-CT'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  codingSystems?: string[];

  @ApiPropertyOptional({
    description: 'Template metadata (FHIR extensions)',
    example: {
      fhirVersion: 'R4',
      specialty: 'internal-medicine',
      version: '1.0',
      lastUpdated: '2024-01-15',
    },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
