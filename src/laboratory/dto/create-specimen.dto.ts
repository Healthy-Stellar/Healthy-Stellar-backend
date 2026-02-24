import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SpecimenTypeEnum } from '../entities/specimen.entity';

export class CreateSpecimenDto {
  @ApiProperty({
    description: 'Specimen ID (barcode/accession number)',
    example: 'SPEC-2024-001234',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  specimenId: string;

  @ApiProperty({
    description: 'Lab order ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  labOrderId: string;

  @ApiProperty({
    enum: SpecimenTypeEnum,
    description: 'Specimen type',
    example: SpecimenTypeEnum.BLOOD,
  })
  @IsEnum(SpecimenTypeEnum)
  @IsNotEmpty()
  specimenType: SpecimenTypeEnum;

  @ApiPropertyOptional({
    description: 'Collection date (ISO 8601 format)',
    example: '2024-01-26T10:30:00Z',
  })
  @IsDateString()
  @IsOptional()
  collectionDate?: string;

  @ApiProperty({
    description: 'User ID of person who collected specimen',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsNotEmpty()
  collectedBy: string;

  @ApiPropertyOptional({
    description: 'Name of person who collected specimen',
    example: 'Nurse Johnson',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  collectedByName?: string;

  @ApiPropertyOptional({
    description: 'Collection site (anatomical location)',
    example: 'Left antecubital fossa',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  collectionSite?: string;

  @ApiPropertyOptional({
    description: 'Collection location (room/department)',
    example: 'Room 301, Outpatient Lab',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  collectionLocation?: string;

  @ApiPropertyOptional({
    description: 'Specimen volume',
    example: 5.0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  volume?: number;

  @ApiPropertyOptional({
    description: 'Volume unit',
    example: 'mL',
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  volumeUnit?: string;

  @ApiPropertyOptional({
    description: 'Container ID',
    example: 'TUBE-001234',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  containerId?: string;

  @ApiPropertyOptional({
    description: 'Container type',
    example: 'EDTA tube',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  containerType?: string;

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
