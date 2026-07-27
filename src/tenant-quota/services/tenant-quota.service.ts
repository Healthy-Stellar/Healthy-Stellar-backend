import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis'; // adjust to your Redis module
import { Repository } from 'typeorm';
import Redis from 'ioredis';

import { TenantQuota } from '../entities/tenant-quota.entity';
import { UpdateTenantQuotaDto } from '../dto/tenant-quota.dto';
import {
  QUOTA_TIER_DEFAULTS,
  QuotaTierLimits,
  TenantTier,
} from '../interfaces/quota-tier.interface';
import {
  QuotaRedisKeys,
  secondsUntilMonthEnd,
  secondsUntilNextHour,
} from './quota-redis-keys';

export type QuotaType = 'records' | 'apiCalls' | 'bulkOperations' | 'storage';

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  quotaType: QuotaType;
}

@Injectable()
export class TenantQuotaService {
  private readonly logger = new Logger(TenantQuotaService.name);

  constructor(
    @InjectRepository(TenantQuota)
    private readonly quotaRepo: Repository<TenantQuota>,

    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Check whether the tenant is allowed to create one more record this month.
   * Does NOT increment the counter – call `incrementRecords()` after the DB
   * write succeeds.
   */
  async checkRecordQuota(tenantId: string): Promise<QuotaCheckResult> {
    const limits = await this.resolvedLimits(tenantId);
    const key = QuotaRedisKeys.monthlyRecords(tenantId);
    const used = await this.getCounter(key);
    return {
      allowed: used < limits.recordsPerMonth,
      used,
      limit: limits.recordsPerMonth,
      quotaType: 'records',
    };
  }

  /**
   * Check and atomically increment the hourly API-call counter.
   * Returns the result BEFORE the increment so callers can gate on `allowed`.
   */
  async checkAndIncrementApiCall(tenantId: string): Promise<QuotaCheckResult> {
    const limits = await this.resolvedLimits(tenantId);
    const key = QuotaRedisKeys.hourlyApiCalls(tenantId);
    const ttl = secondsUntilNextHour();

    // INCR is atomic; set TTL only on first write to preserve the existing window.
    const newCount = await this.redis.incr(key);
    if (newCount === 1) {
      await this.redis.expire(key, ttl);
    }

    const used = newCount - 1; // value BEFORE this request
    return {
      allowed: used < limits.apiCallsPerHour,
      used,
      limit: limits.apiCallsPerHour,
      quotaType: 'apiCalls',
    };
  }

  /**
   * Increment the record counter after a successful DB write.
   * Idempotent: if the key already has a TTL it is preserved.
   */
  async incrementRecords(tenantId: string, by = 1): Promise<void> {
    const key = QuotaRedisKeys.monthlyRecords(tenantId);
    const ttl = secondsUntilMonthEnd();
    const newCount = await this.redis.incrby(key, by);
    if (newCount === by) {
      // First write this month – set the monthly TTL
      await this.redis.expire(key, ttl);
    }
  }

  /**
   * Decrement the record counter (e.g. on soft-delete / rollback).
   * Will not go below 0.
   */
  async decrementRecords(tenantId: string, by = 1): Promise<void> {
    const key = QuotaRedisKeys.monthlyRecords(tenantId);
    const current = await this.getCounter(key);
    if (current > 0) {
      await this.redis.decrby(key, Math.min(by, current));
    }
  }

  /**
   * Check whether a new bulk operation (import/export) can start.
   */
  async checkBulkOperationQuota(tenantId: string): Promise<QuotaCheckResult> {
    const limits = await this.resolvedLimits(tenantId);
    const key = QuotaRedisKeys.bulkOperations(tenantId);
    const used = await this.getCounter(key);
    return {
      allowed: used < limits.bulkOperationsConcurrent,
      used,
      limit: limits.bulkOperationsConcurrent,
      quotaType: 'bulkOperations',
    };
  }

  /**
   * Increment the active-bulk-operation gauge.
   * Sets a 6-hour self-healing TTL so crashed workers don't block the tenant.
   */
  async startBulkOperation(tenantId: string): Promise<void> {
    const key = QuotaRedisKeys.bulkOperations(tenantId);
    const BULK_OP_TTL_SECONDS = 6 * 60 * 60; // 6 hours
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, BULK_OP_TTL_SECONDS);
    }
  }

  /** Decrement the active-bulk-operation gauge when a job finishes. */
  async endBulkOperation(tenantId: string): Promise<void> {
    const key = QuotaRedisKeys.bulkOperations(tenantId);
    const current = await this.getCounter(key);
    if (current > 0) {
      await this.redis.decr(key);
    }
  }

  /**
   * Update storage usage by a delta (positive = upload, negative = deletion).
   * Caller is responsible for supplying the correct byte delta.
   */
  async adjustStorageBytes(tenantId: string, deltaBytes: number): Promise<void> {
    const key = QuotaRedisKeys.storageBytes(tenantId);
    if (deltaBytes > 0) {
      await this.redis.incrby(key, deltaBytes);
    } else if (deltaBytes < 0) {
      const current = await this.getCounter(key);
      await this.redis.set(key, Math.max(0, current + deltaBytes));
    }
  }

  // ─── Usage Summary ─────────────────────────────────────────────────────────

  async getUsageSummary(tenantId: string) {
    const limits = await this.resolvedLimits(tenantId);
    const quota = await this.findOrCreateQuota(tenantId);

    const [records, apiCalls, bulkOps, storageBytes] = await Promise.all([
      this.getCounter(QuotaRedisKeys.monthlyRecords(tenantId)),
      this.getCounter(QuotaRedisKeys.hourlyApiCalls(tenantId)),
      this.getCounter(QuotaRedisKeys.bulkOperations(tenantId)),
      this.getCounter(QuotaRedisKeys.storageBytes(tenantId)),
    ]);

    const toCounter = (used: number, limit: number) => ({
      used,
      limit,
      exceeded: used >= limit,
      percentUsed: limit === Number.MAX_SAFE_INTEGER
        ? 0
        : parseFloat(((used / limit) * 100).toFixed(2)),
    });

    const now = new Date();
    return {
      tenantId,
      tier: quota.tier,
      records: toCounter(records, limits.recordsPerMonth),
      storage: toCounter(storageBytes, limits.storageBytes),
      apiCalls: toCounter(apiCalls, limits.apiCallsPerHour),
      bulkOperations: toCounter(bulkOps, limits.bulkOperationsConcurrent),
      monthlyResetAt: nextMonthStart().toISOString(),
      hourlyResetAt: nextHourStart().toISOString(),
    };
  }

  // ─── Admin CRUD ────────────────────────────────────────────────────────────

  async updateQuota(
    tenantId: string,
    dto: UpdateTenantQuotaDto,
  ): Promise<TenantQuota> {
    const quota = await this.findOrCreateQuota(tenantId);
    Object.assign(quota, dto);
    return this.quotaRepo.save(quota);
  }

  async resetCounters(tenantId: string): Promise<void> {
    const keys = [
      QuotaRedisKeys.monthlyRecords(tenantId),
      QuotaRedisKeys.hourlyApiCalls(tenantId),
      QuotaRedisKeys.bulkOperations(tenantId),
    ];
    if (keys.length) {
      await this.redis.del(...keys);
    }
    this.logger.warn(`Quota counters reset for tenant ${tenantId}`);
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async resolvedLimits(tenantId: string): Promise<QuotaTierLimits> {
    const quota = await this.findOrCreateQuota(tenantId);
    const defaults = QUOTA_TIER_DEFAULTS[quota.tier];
    return {
      recordsPerMonth:
        quota.customRecordsPerMonth ?? defaults.recordsPerMonth,
      storageBytes:
        quota.customStorageBytes ?? defaults.storageBytes,
      apiCallsPerHour:
        quota.customApiCallsPerHour ?? defaults.apiCallsPerHour,
      bulkOperationsConcurrent:
        quota.customBulkOperationsConcurrent ??
        defaults.bulkOperationsConcurrent,
    };
  }

  /** Upsert: create the row with free-tier defaults if it doesn't exist yet. */
  private async findOrCreateQuota(tenantId: string): Promise<TenantQuota> {
    let quota = await this.quotaRepo.findOne({ where: { tenantId } });
    if (!quota) {
      quota = this.quotaRepo.create({ tenantId, tier: 'free' as TenantTier });
      quota = await this.quotaRepo.save(quota);
    }
    return quota;
  }

  private async getCounter(key: string): Promise<number> {
    const raw = await this.redis.get(key);
    return raw ? parseInt(raw, 10) : 0;
  }
}

// ─── Date helpers (isolated for easy testing) ─────────────────────────────────

function nextMonthStart(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
}

function nextHourStart(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() + 1,
    ),
  );
}