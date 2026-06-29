import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantConfigService } from '../services/tenant-config.service';
import { SUPPORTED_CONFIG_KEYS } from '../constants/config-keys.constant';

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  if (!bits) return ip === range;
  const mask = ~((1 << (32 - parseInt(bits, 10))) - 1) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  return req.ip || req.socket?.remoteAddress || '';
}

@Injectable()
export class TenantIpAllowlistGuard implements CanActivate {
  private readonly logger = new Logger(TenantIpAllowlistGuard.name);

  constructor(private readonly tenantConfigService: TenantConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = this.extractTenantId(request);

    if (!tenantId) {
      return true;
    }

    const allowlist = await this.tenantConfigService.get<string[]>(
      tenantId,
      SUPPORTED_CONFIG_KEYS.IP_ALLOWLIST,
    );

    if (!allowlist || !Array.isArray(allowlist) || allowlist.length === 0) {
      return true;
    }

    const clientIp = getClientIp(request);

    if (!clientIp) {
      this.logger.warn(`Unable to determine client IP for tenant ${tenantId}`);
      throw new ForbiddenException('IP address validation failed');
    }

    const allowed = allowlist.some((entry) =>
      entry.includes('/') ? isInCidr(clientIp, entry) : clientIp === entry,
    );

    if (!allowed) {
      this.logger.warn(`IP ${clientIp} not in allowlist for tenant ${tenantId}`);
      throw new ForbiddenException('Access from this IP address is not allowed');
    }

    return true;
  }

  private extractTenantId(request: any): string | null {
    if (request.params?.tenantId) {
      return request.params.tenantId;
    }

    if (request.query?.tenantId) {
      return request.query.tenantId;
    }

    if (request.headers['x-tenant-id']) {
      return request.headers['x-tenant-id'];
    }

    if (request.user?.tenantId) {
      return request.user.tenantId;
    }

    if (request.user?.organizationId) {
      return request.user.organizationId;
    }

    return null;
  }
}
