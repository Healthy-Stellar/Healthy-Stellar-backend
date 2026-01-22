import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateCategory } from '../entities/clinical-note-template.entity';

export class CreateClinicalTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: TemplateCategory, description: 'Template category' })
  @IsEnum(TemplateCategory)
  @IsNotEmpty()
  category: TemplateCategory;

  @ApiProperty({ description: 'Template content' })
  @IsString()
  @IsNotEmpty()
  templateContent: string;

  @ApiPropertyOptional({ description: 'Structured fields definition' })
  @IsObject()
  @IsOptional()
  structuredFields?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Is template active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
