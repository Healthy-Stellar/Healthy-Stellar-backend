import { SetMetadata } from '@nestjs/common';

export const THROTTLER_LIMIT = 'throttler:limit';
export const THROTTLER_TTL = 'throttler:ttl';
export const THROTTLER_CATEGORY = 'throttler:category';

export type RateLimitCategory = 'auth' | 'read' | 'write' | 'admin' | 'default';

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
 * Set rate limit category for endpoint
 * @param category - Rate limit category (auth, read, write, admin)
 */
export const RateLimitCategory = (category: RateLimitCategory) => {
  return SetMetadata(THROTTLER_CATEGORY, category);
};

/**
 * Predefined rate limit for authentication endpoints
 * 5 requests per minute per IP
 */
export const AuthRateLimit = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    RateLimit(5, 60)(target, propertyKey, descriptor);
    RateLimitCategory('auth')(target, propertyKey, descriptor);
  };
};

/**
 * Predefined rate limit for read endpoints
 * 100 requests per minute per JWT
 */
export const ReadRateLimit = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    RateLimit(100, 60)(target, propertyKey, descriptor);
    RateLimitCategory('read')(target, propertyKey, descriptor);
  };
};

/**
 * Predefined rate limit for write endpoints
 * 20 requests per minute per JWT
 */
export const WriteRateLimit = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    RateLimit(20, 60)(target, propertyKey, descriptor);
    RateLimitCategory('write')(target, propertyKey, descriptor);
  };
};

/**
 * Predefined rate limit for admin endpoints
 * 50 requests per minute per JWT
 */
export const AdminRateLimit = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    RateLimit(50, 60)(target, propertyKey, descriptor);
    RateLimitCategory('admin')(target, propertyKey, descriptor);
  };
};

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
