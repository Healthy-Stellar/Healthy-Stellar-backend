import { SetMetadata } from '@nestjs/common';

export const THROTTLER_LIMIT = 'throttler:limit';
export const THROTTLER_TTL = 'throttler:ttl';

/**
 * Custom decorator to set specific rate limits for endpoints
 * @param limit - Number of requests allowed
 * @param ttl - Time window in seconds
 */
export const RateLimit = (limit: number, ttl: number = 60) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(THROTTLER_LIMIT, limit)(target, propertyKey, descriptor);
    SetMetadata(THROTTLER_TTL, ttl * 1000)(target, propertyKey, descriptor); // Convert to milliseconds
  };
};

/**
 * Predefined rate limit for authentication endpoints
 * 10 requests per minute
 */
export const AuthRateLimit = () => RateLimit(10, 60);

/**
 * Predefined rate limit for verification endpoints
 * 5 requests per minute
 */
export const VerifyRateLimit = () => RateLimit(5, 60);

/**
 * Predefined rate limit for sensitive operations
 * 20 requests per minute
 */
export const SensitiveRateLimit = () => RateLimit(20, 60);
