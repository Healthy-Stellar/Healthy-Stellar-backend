import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';
import { DataResidencyRegion } from '../../enums/data-residency.enum';

export interface TenantContextData {
  tenantId: string;
  tenantSlug: string;
  schemaName: string;
  region?: DataResidencyRegion;
  strictDataResidency?: boolean;
}

/**
 * Shape of the authenticated principal attached to `request.user` by
 * `JwtAuthGuard`. Only the fields needed to resolve the tenant are declared
 * here so the context can be bound from the principal rather than from a
 * client-supplied header.
 */
export interface AuthenticatedPrincipal {
  userId?: string;
  id?: string;
  organizationId?: string;
  tenantId?: string;
  tenantSlug?: string;
  role?: string;
  roles?: string[];
}

@Injectable()
export class TenantContext {
  private static storage = new AsyncLocalStorage<TenantContextData>();

  static run<T>(context: TenantContextData, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  static get(): TenantContextData | undefined {
    return this.storage.getStore();
  }

  static getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  static getTenantSlug(): string | undefined {
    return this.storage.getStore()?.tenantSlug;
  }

  static getSchemaName(): string | undefined {
    return this.storage.getStore()?.schemaName;
  }

  /**
   * Resolve the tenant identifier from the authenticated principal. This is
   * the authoritative source of tenancy; the `X-Tenant-ID` header must never
   * be trusted on its own.
   */
  static getPrincipalTenantId(
    principal: AuthenticatedPrincipal | undefined,
  ): string | undefined {
    if (!principal) {
      return undefined;
    }
    return principal.tenantId ?? principal.organizationId;
  }

  /**
   * Resolve the tenant slug from the authenticated principal, if present.
   */
  static getPrincipalTenantSlug(
    principal: AuthenticatedPrincipal | undefined,
  ): string | undefined {
    return principal?.tenantSlug;
  }

  /**
   * Whether the principal is allowed to operate across tenants (e.g. a
   * `SUPER_ADMIN`). Such principals may target a tenant via the header.
   */
  static isSuperAdmin(
    principal: AuthenticatedPrincipal | undefined,
  ): boolean {
    if (!principal) {
      return false;
    }
    if (principal.role === 'SUPER_ADMIN') {
      return true;
    }
    return Array.isArray(principal.roles) && principal.roles.includes('SUPER_ADMIN');
  }

  /**
   * Validate a client-supplied tenant hint against the authenticated
   * principal. The hint is only accepted when it matches the principal's own
   * tenant, or when the principal is a `SUPER_ADMIN`.
   *
   * Returns `true` when the hint is absent or acceptable, `false` when it
   * attempts to select a tenant the principal does not belong to.
   */
  static isTenantHintAllowed(
    principal: AuthenticatedPrincipal | undefined,
    hint: string | undefined,
  ): boolean {
    if (!hint) {
      return true;
    }
    if (this.isSuperAdmin(principal)) {
      return true;
    }
    const principalTenantId = this.getPrincipalTenantId(principal);
    const principalTenantSlug = this.getPrincipalTenantSlug(principal);
    return hint === principalTenantId || hint === principalTenantSlug;
  }

  static clear(): void {
    this.storage.disable();
  }
}
