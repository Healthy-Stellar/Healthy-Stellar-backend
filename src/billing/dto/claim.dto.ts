import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  IsDateString,
  MaxLength,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClaimStatus, ClaimType } from '../../common/enums';

class AddressDto {
  @ApiProperty()
  @IsString()
  street: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  state: string;

  @ApiProperty()
  @IsString()
  zip: string;
}

class ProviderInfoDto {
  @ApiProperty({ example: '1234567890' })
  @IsString()
  npi: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  taxId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

class FacilityInfoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  npi?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiProperty({ example: '11' })
  @IsString()
  placeOfService: string;
}

class SubscriberInfoDto {
  @ApiProperty()
  @IsString()
  memberId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  dob: string;

  @ApiProperty()
  @IsString()
  gender: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

class PatientInfoDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  dob: string;

  @ApiProperty()
  @IsString()
  gender: string;

  @ApiProperty({ example: 'self' })
  @IsString()
  relationship: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

class DiagnosisDto {
  @ApiProperty({ example: 'J06.9' })
  @IsString()
  code: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  sequence: number;
}

class ProcedureDto {
  @ApiProperty({ example: '99213' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ example: ['25'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifiers?: string[];

  @ApiProperty({ example: 1 })
  @IsNumber()
  units: number;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  charge: number;

  @ApiProperty({ example: [1] })
  @IsArray()
  @IsNumber({}, { each: true })
  diagnosisPointers: number[];
}

export class CreateClaimDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  billingId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  insuranceId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  patientId: string;

  @ApiPropertyOptional({ enum: ClaimType })
  @IsOptional()
  @IsEnum(ClaimType)
  claimType?: ClaimType;

  @ApiProperty()
  @IsDateString()
  serviceStartDate: string;

  @ApiProperty()
  @IsDateString()
  serviceEndDate: string;

  @ApiProperty({ type: [DiagnosisDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisDto)
  diagnosisCodes: DiagnosisDto[];

  @ApiProperty({ type: [ProcedureDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcedureDto)
  procedureCodes: ProcedureDto[];

  @ApiProperty({ type: ProviderInfoDto })
  @ValidateNested()
  @Type(() => ProviderInfoDto)
  provider: ProviderInfoDto;

  @ApiPropertyOptional({ type: FacilityInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityInfoDto)
  facility?: FacilityInfoDto;

  @ApiProperty({ type: SubscriberInfoDto })
  @ValidateNested()
  @Type(() => SubscriberInfoDto)
  subscriber: SubscriberInfoDto;

  @ApiPropertyOptional({ type: PatientInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientInfoDto)
  patient?: PatientInfoDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateClaimDto {
  @ApiPropertyOptional({ enum: ClaimStatus })
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerClaimNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  allowedAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  paidAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  adjustmentAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  patientResponsibility?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  copayAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deductibleAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  coinsuranceAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  remarkCodes?: Array<{
    code: string;
    description: string;
  }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  adjustmentCodes?: Array<{
    groupCode: string;
    reasonCode: string;
    amount: number;
  }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitClaimDto {
  @ApiProperty()
  @IsString()
  claimId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clearinghouseId?: string;
}

export class ClaimSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insuranceId?: string;

  @ApiPropertyOptional({ enum: ClaimStatus })
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  @ApiPropertyOptional({ enum: ClaimType })
  @IsOptional()
  @IsEnum(ClaimType)
  claimType?: ClaimType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class ProcessERADto {
  @ApiProperty({ description: 'EDI 835 content' })
  @IsString()
  edi835Content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eraNumber?: string;
}
