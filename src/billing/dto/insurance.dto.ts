import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  MaxLength,
  IsObject,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InsuranceType, PayerType } from '../../common/enums';

class ContactInfoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fax?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class CreateInsuranceDto {
  @ApiProperty({ description: 'Patient ID' })
  @IsString()
  @MaxLength(100)
  patientId: string;

  @ApiProperty({ example: 'Blue Cross Blue Shield' })
  @IsString()
  @MaxLength(200)
  payerName: string;

  @ApiProperty({ example: 'BCBS001' })
  @IsString()
  @MaxLength(50)
  payerId: string;

  @ApiProperty({ example: 'ABC123456789' })
  @IsString()
  @MaxLength(50)
  memberId: string;

  @ApiPropertyOptional({ example: 'GRP001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  groupNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  groupName?: string;

  @ApiPropertyOptional({ enum: InsuranceType })
  @IsOptional()
  @IsEnum(InsuranceType)
  insuranceType?: InsuranceType;

  @ApiPropertyOptional({ enum: PayerType })
  @IsOptional()
  @IsEnum(PayerType)
  payerType?: PayerType;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MaxLength(100)
  subscriberName: string;

  @ApiProperty({ example: 'self' })
  @IsString()
  @MaxLength(20)
  subscriberRelationship: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  subscriberDob?: string;

  @ApiProperty()
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  terminationDate?: string;

  @ApiPropertyOptional({ example: 'PPO' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  planType?: string;

  @ApiPropertyOptional({ example: 25.0 })
  @IsOptional()
  @IsNumber()
  copay?: number;

  @ApiPropertyOptional({ example: 1500.0 })
  @IsOptional()
  @IsNumber()
  deductible?: number;

  @ApiPropertyOptional({ example: 500.0 })
  @IsOptional()
  @IsNumber()
  deductibleMet?: number;

  @ApiPropertyOptional({ example: 6000.0 })
  @IsOptional()
  @IsNumber()
  outOfPocketMax?: number;

  @ApiPropertyOptional({ example: 1000.0 })
  @IsOptional()
  @IsNumber()
  outOfPocketMet?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  coinsurancePercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  coverageDetails?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactInfoDto)
  contactInfo?: ContactInfoDto;
}

export class UpdateInsuranceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  payerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  payerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  groupNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  groupName?: string;

  @ApiPropertyOptional({ enum: InsuranceType })
  @IsOptional()
  @IsEnum(InsuranceType)
  insuranceType?: InsuranceType;

  @ApiPropertyOptional({ enum: PayerType })
  @IsOptional()
  @IsEnum(PayerType)
  payerType?: PayerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subscriberName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  subscriberRelationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  subscriberDob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  terminationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  planType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  copay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deductible?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deductibleMet?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  outOfPocketMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  outOfPocketMet?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  coinsurancePercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  coverageDetails?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactInfoDto)
  contactInfo?: ContactInfoDto;
}

export class VerifyInsuranceDto {
  @ApiProperty()
  @IsString()
  insuranceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  serviceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceCodes?: string[];
}

export class RequestAuthorizationDto {
  @ApiProperty()
  @IsString()
  insuranceId: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  procedureCodes: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  diagnosisCodes: string[];

  @ApiProperty()
  @IsDateString()
  serviceStartDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  serviceEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  requestedVisits?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clinicalJustification?: string;
}
