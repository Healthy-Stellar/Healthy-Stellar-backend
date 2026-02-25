import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { DataResidencyService } from '../services/data-residency.service';
import { TenantService } from '../../tenant/tenant.service';

/**
 * Guard to enforce data residency compliance
 * Validates that client requests originate from allowed regions
 */
@Injectable()
export class DataResidencyGuard implements CanActivate {
  private readonly logger = new Logger(DataResidencyGuard.name);

  constructor(
    private dataResidencyService: DataResidencyService,
    private tenantService: TenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = request.user?.tenantId;

    // Skip if no tenant context (public endpoints)
    if (!tenantId) {
      return true;
    }

    try {
      // Get tenant and their region
      const tenant = await this.tenantService.findById(tenantId);
      if (!tenant) {
        throw new ForbiddenException('Tenant not found');
      }

      // Skip if strict data residency is not enabled
      if (!tenant.strictDataResidency) {
        return true;
      }

      // Get client IP
      const clientIp = this.getClientIp(request);

      // Get request region header if provided
      const requestRegion = request.headers['x-region-hint'] as string;

      // Check IP against allowed ranges if configured
      if (tenant.allowedIpRanges && tenant.allowedIpRanges.length > 0) {
        const isAllowed = this.dataResidencyService.isIpAllowedForRegion(
          tenant.region,
          clientIp,
          tenant.allowedIpRanges,
        );

        if (!isAllowed) {
          this.logger.warn(
            `Data residency violation: Client IP ${clientIp} not allowed for region ${tenant.region}`,
          );
          throw new ForbiddenException(
            'Client IP not permitted in this data residency region',
          );
        }
      }

      // If region hint provided, validate it matches tenant region
      if (requestRegion && requestRegion !== tenant.region) {
        this.logger.warn(
          `Region hint mismatch: Request region ${requestRegion} does not match tenant region ${tenant.region}`,
        );
        throw new ForbiddenException('Request region does not match tenant region');
      }

      // Attach region info to request for use by downstream middleware/endpoints
      (request as any).dataRegion = tenant.region;

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`Data residency guard error: ${error.message}`);
      throw new ForbiddenException('Data residency validation failed');
    }
  }

  /**
   * Extract client IP from request, handling proxies
   */
  private getClientIp(request: Request): string {
    // Check for various proxy headers
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : forwarded[0];
    }

    const clientIp = request.headers['x-client-ip'];
    if (clientIp) {
      return typeof clientIp === 'string' ? clientIp : clientIp[0];
    }

    // Fallback to socket remote address
    return request.socket.remoteAddress || '0.0.0.0';
  }
}
