import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'City Care Hospital' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'citycare', description: 'URL-safe slug for tenant identification' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
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
