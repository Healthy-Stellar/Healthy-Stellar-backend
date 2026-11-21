import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RevokeGuardianLinkDto {
  @ApiPropertyOptional({ description: 'Reason for revoking guardianship' })
  @IsString()
  @IsOptional()
  reason?: string;
}
