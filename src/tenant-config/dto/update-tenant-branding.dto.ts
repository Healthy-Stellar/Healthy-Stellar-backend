import {
  IsString,
  IsOptional,
  IsUrl,
  IsEmail,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantBrandingDto {
  @ApiPropertyOptional({ description: 'Logo URL (https, max 2048 chars)' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Primary brand color as hex (e.g. #1A73E8)' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primaryColor must be a valid hex color (e.g. #1A73E8)' })
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Secondary brand color as hex (e.g. #34A853)' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'secondaryColor must be a valid hex color (e.g. #34A853)' })
  secondaryColor?: string;

  @ApiPropertyOptional({ description: 'Custom domain (e.g. portal.hospital.com)' })
  @IsOptional()
  @IsString()
  @MaxLength(253)
  @Matches(/^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*$/, {
    message: 'customDomain must be a valid hostname',
  })
  customDomain?: string;

  @ApiPropertyOptional({ description: 'Support contact email' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  supportEmail?: string;

  @ApiPropertyOptional({ description: 'Support contact phone' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  supportPhone?: string;

  @ApiPropertyOptional({ description: 'Organization display name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationName?: string;
}
