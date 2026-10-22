import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisService } from '@nestjs/modules/redis'; // Adjust based on your Redis module setup
import { PrismaService } from '../config/prisma.service'; // Adjust based on your ORM setup

@Injectable()
export class TenantQuotaService {
  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Fetches the cached quota details from Redis.
   * If cache misses, fall back to DB and cache it.
   */
  async getTenantQuotaStatus(tenantId: string): Promise<{ currentUsage: number; maxQuota: number }> {
    const cacheKey = `tenant:quota:${tenantId}`;
    const client = this.redisService.getClient();
    
    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // Fallback to DB if cache isn't warmed up yet
    const tenantQuota = await this.prisma.tenantQuota.findUnique({
      where: { tenantId },
    });

    if (!tenantQuota) {
      throw new NotFoundException('Tenant quota configuration not found.');
    }

    const quotaData = {
      currentUsage: tenantQuota.currentUsage, // in bytes/MB
      maxQuota: tenantQuota.maxQuota,
    };

    // Cache fallback asynchronously for safety
    await client.set(cacheKey, JSON.stringify(quotaData), 'EX', 300); // 5 minutes

    return quotaData;
  }

  /**
   * Admin override to adjust or upgrade a tenant's quota limit
   */
  async overrideQuota(tenantId: string, newMaxQuota: number): Promise<void> {
    await this.prisma.tenantQuota.update({
      where: { tenantId },
      data: { maxQuota: newMaxQuota },
    });

    // Invalidate or update the Redis cache immediately so changes reflect instantly
    const cacheKey = `tenant:quota:${tenantId}`;
    const client = this.redisService.getClient();
    const cachedData = await client.get(cacheKey);
    
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      parsed.maxQuota = newMaxQuota;
      await client.set(cacheKey, JSON.stringify(parsed), 'EX', 300);
    }
  }
}