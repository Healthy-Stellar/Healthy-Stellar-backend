import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  blocked: boolean;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  blockedUntil?: number;
}

/**
 * Healthcare-specific rate limiting with different tiers per endpoint type
 */
@Injectable()
export class RateLimitingService {
  private readonly logger = new Logger(RateLimitingService.name);
  private readonly store = new Map<string, RateLimitEntry>();

  // HIPAA-aligned rate limit profiles
  readonly PROFILES: Record<string, RateLimitConfig> = {
    // PHI access - strict limits to prevent bulk harvesting
    PHI_ACCESS: { windowMs: 60_000, maxRequests: 30, blockDurationMs: 300_000 },
    // Authentication - prevent brute force
    AUTH: { windowMs: 60_000, maxRequests: 5, blockDurationMs: 900_000 },
    // Medical device telemetry - higher allowance
    DEVICE_TELEMETRY: { windowMs: 60_000, maxRequests: 300 },
    // API general - moderate limits
    API_GENERAL: { windowMs: 60_000, maxRequests: 100, blockDurationMs: 60_000 },
    // Audit log queries - limited
    AUDIT_QUERY: { windowMs: 60_000, maxRequests: 20 },
    // Admin operations - very strict
    ADMIN: { windowMs: 60_000, maxRequests: 10, blockDurationMs: 60_000 },
    // Incident reporting - generous
    INCIDENT_REPORT: { windowMs: 60_000, maxRequests: 50 },
    // Breach notification - very generous (emergencies)
    BREACH_NOTIFICATION: { windowMs: 60_000, maxRequests: 200 },
  };

  constructor(private readonly configService: ConfigService) {
    this.startCleanup();
  }

  /**
   * Check and update rate limit for a given key and profile
   */
  check(key: string, profile: keyof typeof this.PROFILES | RateLimitConfig): RateLimitResult {
    const config: RateLimitConfig = typeof profile === 'string' ? this.PROFILES[profile] : profile;

    if (!config) {
      throw new Error(`Unknown rate limit profile: ${profile}`);
    }

    const now = Date.now();
    const entry = this.store.get(key) || { count: 0, windowStart: now };

    // Check if currently blocked
    if (entry.blockedUntil && entry.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.blockedUntil),
        blocked: true,
      };
    }

    // Reset window if expired
    if (now - entry.windowStart > config.windowMs) {
      entry.count = 0;
      entry.windowStart = now;
      entry.blockedUntil = undefined;
    }

    entry.count++;
    const allowed = entry.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetAt = new Date(entry.windowStart + config.windowMs);

    // Apply block if exceeded
    if (!allowed && config.blockDurationMs) {
      entry.blockedUntil = now + config.blockDurationMs;
      this.logger.warn(`Rate limit exceeded for key: ${key} (profile: ${profile})`);
    }

    this.store.set(key, entry);

    return { allowed, remaining, resetAt, blocked: !allowed && !!entry.blockedUntil };
  }

  /**
   * Build rate limit key combining IP + user ID + endpoint
   */
  buildKey(ipAddress: string, userId?: string, endpoint?: string): string {
    const parts = [ipAddress, userId || 'anonymous', endpoint || 'default'];
    return parts.join(':');
  }

  /**
   * Check IP-level rate limiting (additional layer for medical devices)
   */
  checkIpLimit(ipAddress: string): RateLimitResult {
    return this.check(`ip:${ipAddress}`, {
      windowMs: 60_000,
      maxRequests: 500, // IP-level ceiling
      blockDurationMs: 120_000,
    });
  }

  /**
   * Check if IP/user is currently blocked
   */
  isBlocked(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry?.blockedUntil) return false;
    return entry.blockedUntil > Date.now();
  }

  /**
   * Manually unblock a key (for admin actions)
   */
  unblock(key: string): void {
    const entry = this.store.get(key);
    if (entry) {
      entry.blockedUntil = undefined;
      entry.count = 0;
      this.store.set(key, entry);
    }
  }

  /**
   * Get current status for a key
   */
  getStatus(key: string, profile: string): RateLimitResult {
    const config = this.PROFILES[profile];
    const entry = this.store.get(key) || { count: 0, windowStart: Date.now() };
    const now = Date.now();

    return {
      allowed: entry.count < (config?.maxRequests || 100),
      remaining: Math.max(0, (config?.maxRequests || 100) - entry.count),
      resetAt: new Date(entry.windowStart + (config?.windowMs || 60_000)),
      blocked: !!(entry.blockedUntil && entry.blockedUntil > now),
    };
  }

  private startCleanup(): void {
    // Clean expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      let deleted = 0;
      for (const [key, entry] of this.store) {
        const maxWindow = 900_000; // 15 min max
        if (
          now - entry.windowStart > maxWindow &&
          (!entry.blockedUntil || entry.blockedUntil < now)
        ) {
          this.store.delete(key);
          deleted++;
        }
      }
      if (deleted > 0) {
        this.logger.debug(`Cleaned ${deleted} expired rate limit entries`);
      }
    }, 300_000);
  }
}
