import { IsUUID, IsArray, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AccessLevel } from '../entities/access-grant.entity';

export class CreateAccessGrantDto {
  @ApiProperty({ description: 'Provider ID to grant access to' })
  @IsUUID()
  granteeId: string;

  @ApiProperty({ description: 'Array of medical record IDs' })
  @IsArray()
  @IsUUID('4', { each: true })
  recordIds: string[];

  @ApiProperty({ enum: AccessLevel, description: 'Access level' })
  @IsEnum(AccessLevel)
  accessLevel: AccessLevel;

  @ApiProperty({ required: false, description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
