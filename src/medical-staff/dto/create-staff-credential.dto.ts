import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CredentialType } from '../entities/staff-credential.entity';

export class CreateStaffCredentialDto {
  @ApiProperty({ description: 'Staff (doctor) ID' })
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty({ enum: CredentialType, description: 'Type of credential' })
  @IsEnum(CredentialType)
  type: CredentialType;

  @ApiProperty({ description: 'Credential/license number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  credentialNumber: string;

  @ApiProperty({ description: 'Issuing authority or body' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  issuingBody: string;

  @ApiPropertyOptional({ description: 'State/province of issue' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  issuingState?: string;

  @ApiProperty({ description: 'Date the credential was issued (ISO 8601 date)' })
  @IsDateString()
  issuedAt: string;

  @ApiProperty({ description: 'Expiration date (ISO 8601 date)' })
  @IsDateString()
  expiresAt: string;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
