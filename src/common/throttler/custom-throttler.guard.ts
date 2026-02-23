import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { THROTTLER_LIMIT, THROTTLER_TTL } from './throttler.decorator';
import { Request, Response } from 'express';

/**
 * Enhanced throttler guard with custom rate limits per endpoint
 * and proper header management
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
   */
  protected async getTracker(req: Request): Promise<string> {
    const user = (req as any).user;
    
    if (user) {
      // Use Stellar public key if available, otherwise user ID
      return user.stellarPublicKey || user.userId || user.id || this.getIpFromRequest(req);
    }

    return this.getIpFromRequest(req);
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
   * Handle rate limit logic with custom limits
   */
  async handleRequest(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Get custom rate limits from decorators
    const customLimit = this.reflector.getAllAndOverride<number>(THROTTLER_LIMIT, [handler, classRef]);
    const customTtl = this.reflector.getAllAndOverride<number>(THROTTLER_TTL, [handler, classRef]);

    // Determine rate limit configuration
    const user = (request as any).user;
    let limit: number;
    let ttl: number;

    if (customLimit !== undefined && customTtl !== undefined) {
      // Use custom limits from decorator
      limit = customLimit;
      ttl = customTtl;
    } else if (user) {
      // Authenticated user default limits
      limit = 200;
      ttl = 60000; // 60 seconds
    } else {
      // Unauthenticated default limits
      limit = 100;
      ttl = 60000; // 60 seconds
    }

    // Get tracker
    const tracker = await this.getTracker(request);
    const key = this.generateKey(context, tracker, ttl);

    // Check and increment rate limit
    const { totalHits, timeToExpire } = await this.storageService.increment(key, ttl);

    // Calculate remaining requests
    const remaining = Math.max(0, limit - totalHits);
    const resetTime = Math.ceil(Date.now() / 1000) + Math.ceil(timeToExpire / 1000);

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', resetTime);

    // Check if limit exceeded
    if (totalHits > limit) {
      const retryAfter = Math.ceil(timeToExpire / 1000);
      response.setHeader('Retry-After', retryAfter);
      
      throw new ThrottlerException(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`
      );
    }

    return true;
  }

  /**
   * Generate storage key
   */
  private generateKey(context: ExecutionContext, tracker: string, ttl: number): string {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;
    
    return `throttle:${className}:${methodName}:${tracker}:${ttl}`;
  }
}
