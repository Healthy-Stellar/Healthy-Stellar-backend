import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext, TenantContextData } from '../context/tenant.context';

/**
 * Extracts the current tenant context set by TenantInterceptor.
 *
 * Usage:
 *   @CurrentTenant() tenant: TenantContextData          // full context object
 *   @CurrentTenant('tenantId') tenantId: string         // specific field
 *   @CurrentTenant('tenantSlug') slug: string
 *   @CurrentTenant('schemaName') schema: string
 */
export const CurrentTenant = createParamDecorator(
  (field: keyof TenantContextData | undefined, _ctx: ExecutionContext) => {
    const context = TenantContext.get();
    return field ? context?.[field] : context;
  },
);
