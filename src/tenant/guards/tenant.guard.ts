import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantService } from '../services/tenant.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    // Extract tenant from header or subdomain (same logic as interceptor)
    let tenantSlug: string | undefined;
    tenantSlug = request.headers['x-tenant-id'];
    if (!tenantSlug) {
      const host = request.headers.host || '';
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'localhost' && subdomain !== 'api') {
        tenantSlug = subdomain;
      }
    }

    if (!tenantSlug) {
      throw new ForbiddenException('Tenant identifier not found in request');
    }

    const tenant = await this.tenantService.findBySlug(tenantSlug);
    if (!tenant || tenant.status !== 'active') {
      throw new ForbiddenException('Invalid or inactive tenant');
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Access denied: No organization assigned to user');
    }

    if (user.organizationId !== tenant.id) {
      throw new ForbiddenException('Access denied: Cross-tenant access is not allowed');
    }

    return true;
  }
}
