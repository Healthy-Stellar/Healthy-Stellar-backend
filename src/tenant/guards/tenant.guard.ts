import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantContext } from '../context/tenant.context';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user (public endpoint), allow - interceptor will handle tenant
    if (!user) {
      return true;
    }

    const tenantId = TenantContext.getTenantId();

    if (!tenantId) {
      throw new ForbiddenException('Tenant context not found');
    }

    // Verify user belongs to the tenant
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: User does not belong to this tenant');
    }

    return true;
  }
}
