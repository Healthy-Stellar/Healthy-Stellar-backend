import { IsString, IsUUID, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransmitPrescriptionDto {
  @ApiProperty({ description: 'Prescription ID to transmit' })
  @IsUUID()
  @IsNotEmpty()
  prescriptionId: string;

  @ApiProperty({ description: 'External pharmacy ID to transmit to' })
  @IsUUID()
  @IsNotEmpty()
  externalPharmacyId: string;

  @ApiPropertyOptional({ description: 'Additional notes for the pharmacy' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RetryTransmissionDto {
  @ApiProperty({ description: 'Transmission ID to retry' })
  @IsUUID()
  @IsNotEmpty()
  transmissionId: string;
}

export class RegisterExternalPharmacyDto {
  @ApiProperty({ description: 'Pharmacy name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'NCPDP provider ID (7-digit)' })
  @IsString()
  @IsNotEmpty()
  ncpdpId: string;

  @ApiPropertyOptional({ description: 'National Provider Identifier' })
  @IsString()
  @IsOptional()
  npi?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Fax number' })
  @IsString()
  @IsOptional()
  fax?: string;
}
