import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
  THROTTLER_CATEGORY,
  RateLimitCategory,
} from './throttler.decorator';
import { Request, Response } from 'express';

/**
 * Enhanced throttler guard with custom rate limits per endpoint category
 * and proper header management with Retry-After support
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    protected readonly options: any,
    protected readonly storageService: any,
    protected readonly reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Get tracker key for rate limiting
   * - For authenticated requests: use JWT sub (user ID)
   * - For unauthenticated requests: use IP address
   */
  protected async getTracker(req: Request): Promise<string> {
    const user = (req as any).user;

    if (user) {
      // Use user ID from JWT for authenticated requests
      return `user:${user.userId || user.id || user.sub}`;
    }

    // Use IP for unauthenticated requests
    return `ip:${this.getIpFromRequest(req)}`;
  }

  /**
   * Extract IP address handling proxies
   */
  private getIpFromRequest(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  /**
   * Get rate limit configuration based on category and authentication status
   */
  private getRateLimitConfig(
    category: RateLimitCategory | undefined,
    isAuthenticated: boolean,
    customLimit?: number,
    customTtl?: number,
  ): { limit: number; ttl: number } {
    // If custom limits are provided, use them
    if (customLimit !== undefined && customTtl !== undefined) {
      return { limit: customLimit, ttl: customTtl };
    }

    // Apply category-based limits
    switch (category) {
      case 'auth':
        // Auth endpoints: 5 requests/minute per IP (unauthenticated only)
        return { limit: 5, ttl: 60000 };

      case 'read':
        // Read endpoints: 100 requests/minute per JWT
        return isAuthenticated ? { limit: 100, ttl: 60000 } : { limit: 50, ttl: 60000 }; // Lower limit for unauthenticated

      case 'write':
        // Write endpoints: 20 requests/minute per JWT
        return isAuthenticated ? { limit: 20, ttl: 60000 } : { limit: 10, ttl: 60000 }; // Lower limit for unauthenticated

      case 'admin':
        // Admin endpoints: 50 requests/minute per JWT
        return { limit: 50, ttl: 60000 };

      default:
        // Default limits
        return isAuthenticated ? { limit: 100, ttl: 60000 } : { limit: 50, ttl: 60000 };
    }
  }

  /**
   * Handle rate limit logic with custom limits and categories
   */
  async handleRequest(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Get custom rate limits and category from decorators
    const customLimit = this.reflector.getAllAndOverride<number>(THROTTLER_LIMIT, [
      handler,
      classRef,
    ]);
    const customTtl = this.reflector.getAllAndOverride<number>(THROTTLER_TTL, [handler, classRef]);
    const category = this.reflector.getAllAndOverride<RateLimitCategory>(THROTTLER_CATEGORY, [
      handler,
      classRef,
    ]);

    // Determine if user is authenticated
    const user = (request as any).user;
    const isAuthenticated = !!user;

    // Get rate limit configuration
    const { limit, ttl } = this.getRateLimitConfig(
      category,
      isAuthenticated,
      customLimit,
      customTtl,
    );

    // Get tracker (IP or user ID)
    const tracker = await this.getTracker(request);
    const key = this.generateKey(context, tracker, category || 'default');

    // Check and increment rate limit
    const { totalHits, timeToExpire } = await this.storageService.increment(key, ttl);

    // Calculate remaining requests and reset time
    const remaining = Math.max(0, limit - totalHits);
    const resetTime = Math.ceil(Date.now() / 1000) + Math.ceil(timeToExpire / 1000);

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', resetTime);
    response.setHeader('X-RateLimit-Category', category || 'default');

    // Check if limit exceeded
    if (totalHits > limit) {
      const retryAfter = Math.ceil(timeToExpire / 1000);
      response.setHeader('Retry-After', retryAfter);

      throw new ThrottlerException(
        `Rate limit exceeded for ${category || 'default'} endpoints. Try again in ${retryAfter} seconds.`,
      );
    }

    return true;
  }

  /**
   * Generate storage key with category
   */
  private generateKey(context: ExecutionContext, tracker: string, category: string): string {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;

    return `throttle:${category}:${className}:${methodName}:${tracker}`;
  }
}
