import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { QUOTA_TYPE_KEY } from '../decorators/enforce-quota.decorator';
import {
  QuotaType,
  TenantQuotaService,
} from '../services/tenant-quota.service';

/**
 * Guard that reads the `@EnforceQuota(type)` metadata from the route,
 * resolves the tenant from `request.user.tenantId`, and either:
 *
 *  - allows the request through  (quota not exceeded), or
 *  - throws **HTTP 429 Too Many Requests** with a structured body.
 *
 * For `records` quota the guard only CHECKS – the controller/service must call
 * `TenantQuotaService.incrementRecords()` after the DB write succeeds.
 *
 * For `apiCalls` the guard checks AND increments atomically.
 *
 * For `bulkOperations` the guard checks only; the job service must call
 * `startBulkOperation()` / `endBulkOperation()`.
 *
 * Usage (apply after your auth guard so `request.user` is populated):
 * ```ts
 * @Post('import')
 * @UseGuards(JwtAuthGuard, QuotaGuard)
 * @EnforceQuota('bulkOperations')
 * startImport() { … }
 * ```
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly quotaService: TenantQuotaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const quotaType = this.reflector.getAllAndOverride<QuotaType | undefined>(
      QUOTA_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @EnforceQuota decorator → skip check
    if (!quotaType) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = this.extractTenantId(request);

    if (!tenantId) {
      this.logger.warn('QuotaGuard: could not resolve tenantId from request');
      return true; // fail open – let auth guard handle missing tenant
    }

    const result = await this.resolveQuota(quotaType, tenantId);

    if (!result.allowed) {
      this.logger.warn(
        `Quota exceeded – tenant=${tenantId} type=${quotaType} ` +
        `used=${result.used} limit=${result.limit}`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Quota Exceeded',
          message: `${quotaType} quota exceeded for this tenant.`,
          details: {
            quotaType,
            used: result.used,
            limit: result.limit,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Resolve the tenantId from the authenticated request.
   * Adjust this to match your JWT payload / request augmentation shape.
   */
  private extractTenantId(request: Request): string | undefined {
    // Typical NestJS JWT pattern: request.user set by Passport strategy
    const user = (request as any).user as
      | { tenantId?: string }
      | undefined;

    // Fallback: tenant passed via custom header (e.g. from an internal service)
    return user?.tenantId ?? (request.headers['x-tenant-id'] as string);
  }

  private async resolveQuota(quotaType: QuotaType, tenantId: string) {
    switch (quotaType) {
      case 'records':
        return this.quotaService.checkRecordQuota(tenantId);

      case 'apiCalls':
        // Atomically checks + increments in one round-trip
        return this.quotaService.checkAndIncrementApiCall(tenantId);

      case 'bulkOperations':
        return this.quotaService.checkBulkOperationQuota(tenantId);

      default:
        // Unknown quota type → fail open to avoid blocking legitimate traffic
        this.logger.error(`Unknown quotaType: ${quotaType as string}`);
        return { allowed: true, used: 0, limit: 0, quotaType };
    }
  }
}