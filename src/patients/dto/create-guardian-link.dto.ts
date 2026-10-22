import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GuardianRelationshipType } from '../entities/patient-guardian.entity';

export class CreateGuardianLinkDto {
  @ApiProperty({ description: 'UUID of the guardian user account' })
  @IsUUID()
  @IsNotEmpty()
  guardianUserId: string;

  @ApiProperty({ description: 'UUID of the dependent patient record' })
  @IsUUID()
  @IsNotEmpty()
  dependentPatientId: string;

  @ApiProperty({ enum: GuardianRelationshipType })
  @IsEnum(GuardianRelationshipType)
  relationshipType: GuardianRelationshipType;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2030-12-31' })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}
