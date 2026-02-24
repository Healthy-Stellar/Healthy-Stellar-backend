import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  IsArray,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ConsentType {
  VIEW = 'VIEW',
  SHARE = 'SHARE',
  DOWNLOAD = 'DOWNLOAD',
  MODIFY = 'MODIFY',
  DELETE = 'DELETE',
}

export enum ConsentStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export class CreateConsentDto {
  @ApiProperty({
    description: 'Medical record identifier for consent',
    example: 'record-12345-anon',
    pattern: '^[a-zA-Z0-9-]+$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-]+$/)
  recordId: string;

  @ApiProperty({
    description: 'Patient granting consent (anonymized)',
    example: 'patient-67890-anon',
    pattern: '^[a-zA-Z0-9-]+$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-]+$/)
  patientId: string;

  @ApiProperty({
    description: 'Healthcare provider or organization receiving consent',
    example: 'provider-54321-anon',
    pattern: '^[a-zA-Z0-9-]+$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-]+$/)
  grantedTo: string;

  @ApiProperty({
    enum: ConsentType,
    isArray: true,
    description: 'Types of access granted (HIPAA minimum necessary standard)',
    example: [ConsentType.VIEW, ConsentType.SHARE],
    enumName: 'ConsentType',
  })
  @IsArray()
  @IsEnum(ConsentType, { each: true })
  @IsNotEmpty()
  consentTypes: ConsentType[];

  @ApiPropertyOptional({
    description: 'Consent expiration date (ISO 8601 format)',
    example: '2024-12-31T23:59:59Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Purpose of data sharing (required for HIPAA compliance)',
    example: 'Continuity of care - specialist consultation',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @Length(1, 500)
  purpose?: string;

  @ApiPropertyOptional({
    description: 'Additional consent conditions or restrictions',
    example: 'Limited to cardiology consultation only',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @Length(1, 1000)
  conditions?: string;
}
