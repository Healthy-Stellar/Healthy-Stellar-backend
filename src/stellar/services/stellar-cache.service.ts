import { Injectable, Logger } from '@nestjs/common';

export interface CachedFeeData {
  data: any;
  timestamp: number;
  expiresAt: number;
}

/**
 * Stellar Cache Service
 * 
 * Provides in-memory caching for Stellar fee estimates to avoid
 * hammering the Horizon API. Cache TTL is 30 seconds as per requirements.
 */
@Injectable()
export class StellarCacheService {
  private readonly logger = new Logger(StellarCacheService.name);
  private readonly cache = new Map<string, CachedFeeData>();
  private readonly CACHE_TTL_MS = 30_000; // 30 seconds

  /**
   * Get cached fee data if available and not expired
   */
  get(key: string): any | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.logger.debug(`Cache miss for key: ${key}`);
      return null;
    }

    const now = Date.now();
    if (now > cached.expiresAt) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired for key: ${key}`);
      return null;
    }

    this.logger.debug(`Cache hit for key: ${key}`);
    return cached.data;
  }

  /**
   * Set cache data with automatic expiration
   */
  set(key: string, data: any): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + this.CACHE_TTL_MS,
    });
    this.logger.debug(`Cached data for key: ${key}, expires in ${this.CACHE_TTL_MS}ms`);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      ttlMs: this.CACHE_TTL_MS,
    };
  }
}
