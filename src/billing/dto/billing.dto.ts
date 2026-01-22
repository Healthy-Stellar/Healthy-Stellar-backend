import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsDateString,
  MaxLength,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DiagnosisCodeDto {
  @ApiProperty({ example: 'J06.9' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Acute upper respiratory infection' })
  @IsString()
  description: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isPrimary: boolean;
}

class LineItemDto {
  @ApiProperty()
  @IsDateString()
  serviceDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  serviceDateEnd?: string;

  @ApiProperty({ example: '99213' })
  @IsString()
  @MaxLength(10)
  cptCode: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  cptDescription: string;

  @ApiPropertyOptional({ example: ['25'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifiers?: string[];

  @ApiPropertyOptional({ example: ['J06.9'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diagnosisCodes?: string[];

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  units?: number;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  unitCharge: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  revenueCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ndc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateBillingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  patientId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  patientName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  encounterId?: string;

  @ApiProperty()
  @IsDateString()
  serviceDate: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  providerId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  providerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  providerNpi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  facilityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  facilityName?: string;

  @ApiPropertyOptional({ example: '11' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placeOfService?: string;

  @ApiProperty({ type: [DiagnosisCodeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisCodeDto)
  diagnosisCodes: DiagnosisCodeDto[];

  @ApiProperty({ type: [LineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems: LineItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBillingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  patientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  providerNpi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  facilityName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placeOfService?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisCodeDto)
  diagnosisCodes?: DiagnosisCodeDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}

export class AddLineItemDto extends LineItemDto {}

export class UpdateLineItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  serviceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  serviceDateEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cptCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cptDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifiers?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diagnosisCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  units?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitCharge?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  allowedAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  adjustmentAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
