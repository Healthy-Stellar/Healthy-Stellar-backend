import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { THROTTLER_LIMIT, THROTTLER_TTL, THROTTLER_CATEGORY } from './throttler.decorator';
import { PLAN_MULTIPLIERS, TenantSubscriptionPlan } from './throttler.config';
import { Request, Response } from 'express';

/**
 * Per-category rate limits.
 * authenticated / unauthenticated values cover the two auth states.
 * Subscription-plan multipliers (PLAN_MULTIPLIERS) are applied on top.
 */
const CATEGORY_LIMITS: Record<string, { authenticated: number; unauthenticated: number }> = {
  auth:    { authenticated: 5,   unauthenticated: 5   },
  read:    { authenticated: 100, unauthenticated: 50  },
  write:   { authenticated: 20,  unauthenticated: 20  },
  admin:   { authenticated: 50,  unauthenticated: 50  },
  default: { authenticated: 100, unauthenticated: 100 },
};

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
   * Override canActivate so we control the full request lifecycle.
   * This bypasses the v6 ThrottlerGuard.canActivate which changed the
   * handleRequest signature to receive a requestProps object rather than
   * a plain ExecutionContext.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (await this.shouldSkip(context)) {
      return true;
    }
    return this.handleRequest(context);
  }

  protected async getTracker(req: Request): Promise<string> {
    const user = (req as any).user;
    if (user) {
      const userId = user.stellarPublicKey || user.userId || user.id;
      if (userId) return `user:${userId}`;
    }
    const apiKey = (req as any).apiKey;
    if (apiKey?.id) return `api_key:${apiKey.id}`;
    return `ip:${this.ipFrom(req)}`;
  }

  private ipFrom(req: Request): string {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return (Array.isArray(fwd) ? fwd[0] : fwd).split(',')[0].trim();
    const real = req.headers['x-real-ip'];
    if (real) return Array.isArray(real) ? real[0] : real;
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  async handleRequest(context: ExecutionContext): Promise<boolean> {
    const request  = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const handler  = context.getHandler();
    const classRef = context.getClass();

    // 1. Read decorator metadata
    const category      = this.reflector.getAllAndOverride<string>(THROTTLER_CATEGORY, [handler, classRef]) ?? 'default';
    const explicitLimit = this.reflector.getAllAndOverride<number>(THROTTLER_LIMIT,     [handler, classRef]);
    const explicitTtl   = this.reflector.getAllAndOverride<number>(THROTTLER_TTL,       [handler, classRef]);

    // 2. Resolve effective limit — explicit decorator wins, otherwise category × plan multiplier
    const isAuthenticated = !!(request as any).user;
    const categoryLimits  = CATEGORY_LIMITS[category] ?? CATEGORY_LIMITS.default;
    const baseLimit       = isAuthenticated ? categoryLimits.authenticated : categoryLimits.unauthenticated;

    const plan: TenantSubscriptionPlan = ((request as any).user?.tenantPlan as TenantSubscriptionPlan)
      ?? ((request.headers as any)['x-tenant-plan'] as TenantSubscriptionPlan)
      ?? 'starter';
    const multiplier = PLAN_MULTIPLIERS[plan] ?? 1;

    const limit = explicitLimit ?? Math.round(baseLimit * multiplier);
    const ttl   = explicitTtl   ?? 60_000;

    // 3. Build tenant-aware, per-endpoint Redis key
    const tenantId       = (request.headers as any)['x-tenant-id'] ?? 'global';
    const controllerName = classRef.name;
    const methodName     = handler.name;
    const tracker        = await this.getTracker(request);
    const key            = `throttle:${category}:${tenantId}:${controllerName}:${methodName}:${tracker}`;

    // 4. Increment counter and compute headers
    const { totalHits, timeToExpire } = await this.storageService.increment(key, ttl);
    const remaining  = Math.max(0, limit - totalHits);
    const resetTime  = Math.ceil(Date.now() / 1000) + Math.ceil(timeToExpire / 1000);

    response.setHeader('X-RateLimit-Limit',     limit);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset',     resetTime);
    response.setHeader('X-RateLimit-Category',  category);

    // 5. Enforce limit
    if (totalHits > limit) {
      const retryAfter = Math.ceil(timeToExpire / 1000);
      response.setHeader('Retry-After', retryAfter);
      throw new ThrottlerException(
        `Rate limit exceeded for ${category} endpoints. Retry after ${retryAfter}s.`,
      );
    }

    return true;
  }
}
