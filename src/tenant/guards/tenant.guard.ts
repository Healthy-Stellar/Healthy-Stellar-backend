import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantService } from '../services/tenant.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Membership must be verified against an authenticated principal. If the
    // guard runs before authentication (e.g. as a global guard), there is no
    // principal to check against, so we cannot authorize the request here.
    if (!user) {
      throw new ForbiddenException('Access denied: Authentication required');
    }

    // The client header/subdomain is only a hint. The authoritative tenant is
    // the one bound to the authenticated principal.
    let tenantHint: string | undefined;
    tenantHint = request.headers['x-tenant-id'];
    if (!tenantHint) {
      const host = request.headers.host || '';
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'localhost' && subdomain !== 'api') {
        tenantHint = subdomain;
      }
    }

    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    // Resolve the tenant from the principal's organization.
    if (!user.organizationId) {
      throw new ForbiddenException('Access denied: No organization assigned to user');
    }

    const principalTenant = await this.tenantService.findById(user.organizationId);
    if (!principalTenant || principalTenant.status !== 'active') {
      throw new ForbiddenException('Invalid or inactive tenant');
    }

    // If a tenant hint was supplied, it must match the principal's tenant.
    // SUPER_ADMIN may target any active tenant via the hint.
    if (tenantHint) {
      const hintedTenant = await this.tenantService.findBySlug(tenantHint);
      if (!hintedTenant || hintedTenant.status !== 'active') {
        throw new ForbiddenException('Invalid or inactive tenant');
      }

      if (hintedTenant.id !== principalTenant.id) {
        if (!isSuperAdmin) {
          throw new ForbiddenException('Access denied: Cross-tenant access is not allowed');
        }
        // SUPER_ADMIN explicitly targeting another tenant: bind it for the request.
        request.tenant = hintedTenant;
        return true;
      }
    }

    request.tenant = principalTenant;
    return true;
  }
}
