import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Custom throttler guard that properly handles requests behind proxies
 * and implements per-user rate limiting for authenticated requests
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  /**
   * Get the tracker key for rate limiting
   * - For authenticated users: use user ID or Stellar public key
   * - For unauthenticated: use IP address
   */
  protected async getTracker(req: Request): Promise<string> {
    // Check if user is authenticated
    const user = (req as any).user;
    
    if (user) {
      // Use Stellar public key if available, otherwise user ID
      return user.stellarPublicKey || user.userId || user.id || this.getIpFromRequest(req);
    }

    // For unauthenticated requests, use IP
    return this.getIpFromRequest(req);
  }

  /**
   * Extract IP address from request, handling proxies
   */
  private getIpFromRequest(req: Request): string {
    // Check for X-Forwarded-For header (proxy/load balancer)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Check for X-Real-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fallback to connection remote address
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  /**
   * Get the TTL and limit based on context
   * - Authenticated users get higher limits (200 req/min)
   * - Unauthenticated users get lower limits (100 req/min)
   */
  protected async getThrottlerConfig(context: ExecutionContext): Promise<{ ttl: number; limit: number }> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    // Authenticated users get higher limits
    if (user) {
      return {
        ttl: 60000, // 60 seconds
        limit: 200, // 200 requests per minute
      };
    }

    // Unauthenticated users get default limits
    return {
      ttl: 60000, // 60 seconds
      limit: 100, // 100 requests per minute
    };
  }

  /**
   * Generate response headers for rate limiting
   */
  protected async generateResponseHeaders(
    context: ExecutionContext,
    throttlerConfig: { ttl: number; limit: number },
    tracker: string,
  ): Promise<Record<string, string>> {
    const response = context.switchToHttp().getResponse();
    const request = context.switchToHttp().getRequest();

    // Get current usage from storage
    const key = this.generateKey(context, tracker, throttlerConfig.ttl);
    const { totalHits } = await this.storageService.increment(key, throttlerConfig.ttl);

    const remaining = Math.max(0, throttlerConfig.limit - totalHits);
    const resetTime = Math.ceil(Date.now() / 1000) + Math.ceil(throttlerConfig.ttl / 1000);

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', throttlerConfig.limit);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', resetTime);

    // If limit exceeded, add Retry-After header
    if (totalHits > throttlerConfig.limit) {
      const retryAfter = Math.ceil(throttlerConfig.ttl / 1000);
      response.setHeader('Retry-After', retryAfter);
    }

    return {
      'X-RateLimit-Limit': String(throttlerConfig.limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(resetTime),
    };
  }

  /**
   * Generate storage key for rate limiting
   */
  private generateKey(context: ExecutionContext, tracker: string, ttl: number): string {
    const request = context.switchToHttp().getRequest();
    const routePath = request.route?.path || request.url;
    return `throttle:${routePath}:${tracker}:${ttl}`;
  }
}
