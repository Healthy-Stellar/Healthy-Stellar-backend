import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { DataResidencyService } from '../services/data-residency.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { TenantContext } from '../../tenant/context/tenant.context';

/**
 * Guard to enforce data residency compliance
 * Validates that client requests originate from allowed regions
 */
@Injectable()
export class DataResidencyGuard implements CanActivate {
  private readonly logger = new Logger(DataResidencyGuard.name);
  private readonly trustedProxies: Set<string>;

  constructor(
    private dataResidencyService: DataResidencyService,
    private tenantService: TenantService,
    private config: ConfigService,
  ) {
    const proxies = this.config.get<string>('DATA_RESIDENCY_TRUSTED_PROXIES', '');
    this.trustedProxies = new Set(
      proxies
        .split(',')
        .map((ip) => normalizeIp(ip.trim()))
        .filter(Boolean),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const principal = (
      request as Request & { user?: { organizationId?: string | null } }
    ).user;
    const tenantId = principal?.organizationId || TenantContext.getTenantId();

    // Public requests may have no tenant. Authenticated requests may not.
    if (!tenantId) {
      if (principal) {
        throw new ForbiddenException('Authenticated request has no tenant');
      }
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
   * Extract client IP from request, handling proxies.
   * X-Forwarded-For is only read when the immediate connection is a trusted proxy.
   * Each proxy appends the peer it received from, so the walk starts at the right
   * and stops at the first untrusted hop. The leftmost entry is client-controlled.
   */
  private getClientIp(request: Request): string {
    const directIp = normalizeIp(request.socket.remoteAddress || '0.0.0.0');

    if (!this.trustedProxies.has(directIp)) {
      return directIp;
    }

    const forwarded = request.headers['x-forwarded-for'];
    const chain = Array.isArray(forwarded) ? forwarded.join(',') : (forwarded ?? '');
    const hops = chain
      .split(',')
      .map((hop) => normalizeIp(hop.trim()))
      .filter(Boolean);

    for (let i = hops.length - 1; i >= 0; i--) {
      if (!this.trustedProxies.has(hops[i])) {
        return hops[i];
      }
    }

    // Every hop is a trusted proxy: no client address can be attributed, so fail closed
    return directIp;
  }
}

/** Maps IPv4-mapped IPv6 (`::ffff:10.0.0.5`) to its IPv4 form so comparisons match. */
function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:(?=\d{1,3}(\.\d{1,3}){3}$)/i, '');
}
