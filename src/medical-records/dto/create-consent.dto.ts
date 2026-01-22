import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsDateString,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConsentType } from '../entities/medical-record-consent.entity';

export class CreateConsentDto {
  @ApiProperty({ description: 'Medical Record ID' })
  @IsUUID()
  medicalRecordId: string;

  @ApiPropertyOptional({ description: 'User ID to share with' })
  @IsUUID()
  @IsOptional()
  sharedWithUserId?: string;

  @ApiPropertyOptional({ description: 'Organization ID to share with' })
  @IsUUID()
  @IsOptional()
  sharedWithOrganizationId?: string;

  @ApiProperty({ enum: ConsentType, description: 'Type of consent' })
  @IsEnum(ConsentType)
  consentType: ConsentType;

  @ApiPropertyOptional({ description: 'Purpose of consent' })
  @IsString()
  @IsOptional()
  purpose?: string;

  @ApiPropertyOptional({ description: 'Conditions for consent' })
  @IsString()
  @IsOptional()
  conditions?: string;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Additional consent data' })
  @IsObject()
  @IsOptional()
  consentData?: Record<string, any>;
}
