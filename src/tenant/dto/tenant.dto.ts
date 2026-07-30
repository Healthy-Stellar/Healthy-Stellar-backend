import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'City Care Hospital' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'citycare',
    description: 'Lowercase letters, digits, and underscores only (3–63 chars)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_]{3,63}$/, {
    message: 'Slug must match ^[a-z0-9_]{3,63}$',
  })
  slug: string;

  @ApiPropertyOptional({ example: 'GCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' })
  @IsString()
  @IsOptional()
  stellarContractAddress?: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  stellarContractAddress?: string;

  @ApiPropertyOptional({ enum: ['active', 'suspended', 'inactive'] })
  @IsString()
  @IsOptional()
  status?: string;
}
