import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

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
export class IpAllowlistGuard implements CanActivate {
  private readonly allowlist: string[];

  constructor() {
    const raw = process.env.ADMIN_IP_ALLOWLIST || '';
    this.allowlist = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    // If no allowlist configured, deny all (fail-secure)
    if (!this.allowlist.length) {
      throw new ForbiddenException('Admin access not configured');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const clientIp = getClientIp(req);

    const allowed = this.allowlist.some((entry) =>
      entry.includes('/') ? isInCidr(clientIp, entry) : clientIp === entry,
    );

    if (!allowed) {
      throw new ForbiddenException('IP address not allowed');
    }

    return true;
  }
}
