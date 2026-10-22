import { SetMetadata } from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';

export const THROTTLER_LIMIT    = 'throttler:limit';
export const THROTTLER_TTL      = 'throttler:ttl';
export const THROTTLE_PROFILE   = 'throttler:profile';
export const THROTTLER_CATEGORY = 'throttler:category';

/**
 * Override the numeric limit and TTL for a specific handler.
 * @param limit       Max requests allowed in the window
 * @param ttlSeconds  Window size in seconds (default 60)
 */
export const RateLimit = (limit: number, ttlSeconds = 60) =>
  (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(THROTTLER_LIMIT, limit)(target, propertyKey, descriptor);
    SetMetadata(THROTTLER_TTL, ttlSeconds * 1000)(target, propertyKey, descriptor);
  };

/**
 * Pin a handler to a named rate-limit category.
 * The guard resolves the effective limit from CATEGORY_LIMITS at runtime.
 *
 * @example \@RateLimitCategory('read')
 * @example \@RateLimitCategory('write')
 */
export const RateLimitCategory = (category: string) => SetMetadata(THROTTLER_CATEGORY, category);

/**
 * Legacy alias — kept for backward compatibility.
 * Prefer RateLimitCategory for new code.
 */
export const ThrottleProfile = (group: string) => SetMetadata(THROTTLE_PROFILE, group);

/**
 * Swagger decorator factory that documents rate-limit response headers.
 * Attach to controller methods alongside a rate-limit decorator.
 *
 * @param category  Rate-limit category label shown in API docs
 * @param limit     Requests allowed per minute
 */
export const ApiRateLimitDocs = (category: string, limit: number) =>
  (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    ApiHeader({ name: 'X-RateLimit-Limit',     description: `Max ${limit} requests/min (${category})` })(target, propertyKey, descriptor);
    ApiHeader({ name: 'X-RateLimit-Remaining', description: 'Remaining requests in current window' })(target, propertyKey, descriptor);
    ApiHeader({ name: 'X-RateLimit-Reset',     description: 'Unix timestamp when the window resets' })(target, propertyKey, descriptor);
    ApiResponse({ status: 429, description: `Rate limit exceeded — max ${limit} req/min for ${category} endpoints` })(target, propertyKey, descriptor);
  };

// ── Convenience decorators ────────────────────────────────────────────────────

/** 5 req/min — brute-force protection for auth endpoints. */
export const AuthRateLimit = () =>
  (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    RateLimit(5, 60)(target, propertyKey, descriptor);
    SetMetadata(THROTTLER_CATEGORY, 'auth')(target, propertyKey, descriptor);
  };

/** 100 req/min for authenticated / 50 req/min for anonymous — read endpoints. */
export const ReadRateLimit = () =>
  (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    RateLimit(100, 60)(target, propertyKey, descriptor);
    SetMetadata(THROTTLER_CATEGORY, 'read')(target, propertyKey, descriptor);
  };

/** 20 req/min — write/mutating endpoints. */
export const WriteRateLimit = () =>
  (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    RateLimit(20, 60)(target, propertyKey, descriptor);
    SetMetadata(THROTTLER_CATEGORY, 'write')(target, propertyKey, descriptor);
  };

/** 50 req/min — admin operation endpoints. */
export const AdminRateLimit = () =>
  (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    RateLimit(50, 60)(target, propertyKey, descriptor);
    SetMetadata(THROTTLER_CATEGORY, 'admin')(target, propertyKey, descriptor);
  };

/** 5 req/min — sensitive verification endpoints. */
export const VerifyRateLimit    = () => RateLimit(5, 60);

/** 20 req/min — sensitive mutation endpoints. */
export const SensitiveRateLimit = () => RateLimit(20, 60);

/** Pin to the PHI route-group profile (legacy). */
export const PhiRateLimit       = () => ThrottleProfile('phi');
