import { IsEnum, IsOptional, IsArray, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DataResidencyRegion } from '../../enums/data-residency.enum';

/**
 * DTO for updating tenant data residency settings
 */
export class UpdateTenantDataResidencyDto {
  @ApiProperty({
    enum: DataResidencyRegion,
    description: 'Data residency region for the tenant',
    example: 'EU',
  })
  @IsEnum(DataResidencyRegion)
  @IsOptional()
  region?: DataResidencyRegion;

  @ApiProperty({
    type: Boolean,
    description: 'Enable strict data residency enforcement',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  strictDataResidency?: boolean;

  @ApiProperty({
    type: [String],
    description: 'List of allowed IP CIDR ranges (e.g., ["192.168.1.0/24"])',
    example: ['10.0.0.0/8', '192.168.1.0/24'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedIpRanges?: string[];
}

/**
 * DTO for tenant data residency response
 */
export class TenantDataResidencyResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Tenant ID',
  })
  id: string;

  @ApiProperty({
    example: 'HealthCare Provider ABC',
    description: 'Tenant name',
  })
  name: string;

  @ApiProperty({
    enum: DataResidencyRegion,
    example: 'EU',
  })
  region: DataResidencyRegion;

  @ApiProperty({
    example: true,
    description: 'Strict data residency enforcement enabled',
  })
  strictDataResidency: boolean;

  @ApiProperty({
    example: ['10.0.0.0/8'],
    description: 'Allowed IP ranges',
  })
  allowedIpRanges: string[];

  @ApiProperty({
    example: '2026-02-25T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-02-25T12:00:00Z',
  })
  updatedAt: Date;
}

/**
 * DTO for bulk tenant data residency assignment
 */
export class BulkAssignRegionDto {
  @ApiProperty({
    type: [String],
    description: 'List of tenant IDs to assign region',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '223e4567-e89b-12d3-a456-426614174001',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  tenantIds: string[];

  @ApiProperty({
    enum: DataResidencyRegion,
    description: 'Region to assign to all tenants',
    example: 'EU',
  })
  @IsEnum(DataResidencyRegion)
  region: DataResidencyRegion;

  @ApiProperty({
    type: Boolean,
    description: 'Enable strict residency for all tenants',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  strictDataResidency?: boolean;
}
