import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  private readonly metricsToken: string;
  private readonly allowedNetworks: string[];

  constructor(private readonly configService: ConfigService) {
    this.metricsToken = this.configService.get<string>('METRICS_TOKEN', '');
    this.allowedNetworks = this.configService
      .get<string>('METRICS_ALLOWED_NETWORKS', '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16')
      .split(',')
      .map((network) => network.trim());
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);

    // Check if request is from internal network
    if (this.isInternalNetwork(clientIp)) {
      return true;
    }

    // Check for METRICS_TOKEN header
    const token = request.headers['x-metrics-token'] as string;
    
    if (!this.metricsToken) {
      // If no token is configured, only allow internal network access
      throw new ForbiddenException(
        'Metrics endpoint is only accessible from internal network',
      );
    }

    if (!token) {
      throw new UnauthorizedException('METRICS_TOKEN header is required');
    }

    if (token !== this.metricsToken) {
      throw new UnauthorizedException('Invalid METRICS_TOKEN');
    }

    return true;
  }

  private getClientIp(request: Request): string {
    // Check X-Forwarded-For header first (for proxied requests)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Check X-Real-IP header
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to socket address
    return request.socket.remoteAddress || '0.0.0.0';
  }

  private isInternalNetwork(ip: string): boolean {
    // Normalize IPv6 localhost
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      return true;
    }

    // Check localhost
    if (ip === '127.0.0.1' || ip === 'localhost') {
      return true;
    }

    // Check against allowed networks
    for (const network of this.allowedNetworks) {
      if (this.ipMatchesNetwork(ip, network)) {
        return true;
      }
    }

    return false;
  }

  private ipMatchesNetwork(ip: string, network: string): boolean {
    // Simple IP matching (exact match or CIDR notation)
    if (ip === network) {
      return true;
    }

    // Handle CIDR notation (basic implementation)
    if (network.includes('/')) {
      const [networkIp, prefixLength] = network.split('/');
      const prefix = parseInt(prefixLength, 10);
      
      // Convert IPs to binary and compare
      const ipBinary = this.ipToBinary(ip);
      const networkBinary = this.ipToBinary(networkIp);
      
      if (ipBinary && networkBinary) {
        return ipBinary.substring(0, prefix) === networkBinary.substring(0, prefix);
      }
    }

    return false;
  }

  private ipToBinary(ip: string): string | null {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return null;
    }

    return parts
      .map((part) => {
        const num = parseInt(part, 10);
        if (isNaN(num) || num < 0 || num > 255) {
          return null;
        }
        return num.toString(2).padStart(8, '0');
      })
      .join('');
  }
}
