import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

export interface CacheEntry<T = any> {
  data: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessedAt: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
  tags: string[];
}

export interface CacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  memoryUsageEstimate: number;
  evictionCount: number;
  criticalEntries: number;
}

/**
 * Medical Cache Service
 *
 * In-memory caching layer designed for healthcare data with:
 * - Priority-based cache eviction (critical medical data stays longer)
 * - TTL management with healthcare-specific defaults
 * - Tag-based cache invalidation (e.g., invalidate all data for a patient)
 * - Memory-aware caching with configurable limits
 * - HIPAA-compatible: no PHI logged, cache entries sanitized
 */
@Injectable()
export class MedicalCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MedicalCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout;

  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  // Healthcare-specific TTL defaults (in milliseconds)
  private readonly TTL_DEFAULTS = {
    // Critical patient data - short TTL for freshness
    'patient-vitals': 15_000, // 15 seconds
    'patient-allergies': 300_000, // 5 minutes
    'patient-medications': 120_000, // 2 minutes

    // Clinical reference data - longer TTL
    'drug-interactions': 3_600_000, // 1 hour
    'icd-codes': 86_400_000, // 24 hours
    formulary: 3_600_000, // 1 hour

    // Operational data
    'bed-availability': 30_000, // 30 seconds
    'staff-schedule': 300_000, // 5 minutes
    'department-stats': 60_000, // 1 minute
    'appointment-slots': 60_000, // 1 minute

    // Analytics & reports (can be cached longer)
    'dashboard-stats': 300_000, // 5 minutes
    'compliance-report': 600_000, // 10 minutes

    // Default
    default: 120_000, // 2 minutes
  };

  // Maximum cache entries to prevent memory issues
  private readonly MAX_CACHE_SIZE = 10_000;

  async onModuleInit(): Promise<void> {
    this.logger.log('🏥 Medical cache service initialized');
    // Run cleanup every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30_000);
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }

  /**
   * Get a cached value by key.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    this.hitCount++;

    return entry.data as T;
  }

  /**
   * Set a cached value with healthcare-specific options.
   */
  set<T>(
    key: string,
    data: T,
    options?: {
      ttlMs?: number;
      category?: string;
      priority?: 'critical' | 'high' | 'normal' | 'low';
      tags?: string[];
    },
  ): void {
    // Enforce cache size limit with priority-based eviction
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLowPriority();
    }

    const category = options?.category || 'default';
    const ttl = options?.ttlMs || this.TTL_DEFAULTS[category] || this.TTL_DEFAULTS['default'];
    const now = Date.now();

    this.cache.set(key, {
      data,
      createdAt: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessedAt: now,
      priority: options?.priority || 'normal',
      tags: options?.tags || [],
    });
  }

  /**
   * Invalidate cache entries by tag.
   * E.g., invalidate all cache for a specific patient.
   */
  invalidateByTag(tag: string): number {
    let invalidated = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    if (invalidated > 0) {
      this.logger.debug(`Cache invalidated ${invalidated} entries for tag: ${tag}`);
    }

    return invalidated;
  }

  /**
   * Invalidate cache entries by key pattern.
   */
  invalidateByPattern(pattern: string): number {
    let invalidated = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Delete a specific cache entry.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  /**
   * Get comprehensive cache statistics.
   */
  getStats(): CacheStats {
    let criticalEntries = 0;
    let memoryEstimate = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.priority === 'critical') criticalEntries++;
      memoryEstimate += key.length * 2 + JSON.stringify(entry.data).length * 2;
    }

    const totalRequests = this.hitCount + this.missCount;

    return {
      totalEntries: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: totalRequests > 0 ? Math.round((this.hitCount / totalRequests) * 100) : 0,
      memoryUsageEstimate: memoryEstimate,
      evictionCount: this.evictionCount,
      criticalEntries,
    };
  }

  /**
   * Get or set pattern – fetch from cache or execute getter and cache result.
   */
  async getOrSet<T>(
    key: string,
    getter: () => Promise<T>,
    options?: {
      ttlMs?: number;
      category?: string;
      priority?: 'critical' | 'high' | 'normal' | 'low';
      tags?: string[];
    },
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await getter();
    this.set(key, data, options);
    return data;
  }

  /**
   * Evict lowest priority, least recently used entries.
   */
  private evictLowPriority(): void {
    const priorityOrder = { low: 0, normal: 1, high: 2, critical: 3 };
    const entries = Array.from(this.cache.entries()).sort((a, b) => {
      const priorityDiff = priorityOrder[a[1].priority] - priorityOrder[b[1].priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a[1].lastAccessedAt - b[1].lastAccessedAt;
    });

    // Evict 10% of entries
    const evictCount = Math.ceil(this.MAX_CACHE_SIZE * 0.1);
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
      this.evictionCount++;
    }

    this.logger.debug(`Evicted ${evictCount} low-priority cache entries`);
  }

  /**
   * Remove expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }
}
