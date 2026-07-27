import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { TenantTier } from '../interfaces/quota-tier.interface';

// ─── Response DTO ────────────────────────────────────────────────────────────

export class QuotaUsageCounterDto {
  @ApiProperty({ example: 312 })
  used: number;

  @ApiProperty({ example: 5000 })
  limit: number;

  @ApiProperty({ example: false })
  exceeded: boolean;

  @ApiPropertyOptional({ example: 68.4 })
  percentUsed?: number;
}

export class TenantQuotaUsageResponseDto {
  @ApiProperty({ example: 'tenant-uuid-here' })
  tenantId: string;

  @ApiProperty({ example: 'professional' })
  tier: TenantTier;

  @ApiProperty({ type: QuotaUsageCounterDto })
  records: QuotaUsageCounterDto;

  @ApiProperty({ type: QuotaUsageCounterDto })
  storage: QuotaUsageCounterDto;

  @ApiProperty({ type: QuotaUsageCounterDto })
  apiCalls: QuotaUsageCounterDto;

  @ApiProperty({ type: QuotaUsageCounterDto })
  bulkOperations: QuotaUsageCounterDto;

  @ApiProperty({
    example: '2025-06-01T00:00:00.000Z',
    description: 'When monthly counters (records) reset.',
  })
  monthlyResetAt: string;

  @ApiProperty({
    example: '2025-05-12T14:00:00.000Z',
    description: 'When hourly counters (API calls) reset.',
  })
  hourlyResetAt: string;
}

// ─── Update DTO ───────────────────────────────────────────────────────────────

export class UpdateTenantQuotaDto {
  @ApiPropertyOptional({ enum: ['free', 'starter', 'professional', 'enterprise'] })
  @IsOptional()
  @IsEnum(['free', 'starter', 'professional', 'enterprise'])
  tier?: TenantTier;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  customRecordsPerMonth?: number;

  @ApiPropertyOptional({ example: 10737418240 })
  @IsOptional()
  @IsInt()
  @Min(0)
  customStorageBytes?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  customApiCallsPerHour?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  customBulkOperationsConcurrent?: number;
}