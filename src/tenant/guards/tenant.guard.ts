import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantContext } from '../context/tenant.context';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    const tenantId = TenantContext.getTenantId();

    if (!tenantId) {
      throw new ForbiddenException('Tenant context not found');
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Access denied: No organization assigned to user');
    }

    if (user.organizationId !== tenantId) {
      throw new ForbiddenException('Access denied: Cross-tenant access is not allowed');
    }

    return true;
  }
}
