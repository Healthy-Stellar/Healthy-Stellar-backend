import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContext } from '../context/tenant.context';
import { TenantService } from '../services/tenant.service';
import { TenantDatabaseRoutingService } from '../../database/tenant-database-routing.service';
import { DataResidencyRegion } from '../../enums/data-residency.enum';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private tenantService: TenantService,
    private tenantDatabaseRoutingService: TenantDatabaseRoutingService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // Extract tenant from subdomain or X-Tenant-ID header
    let tenantSlug: string | undefined;

    // Try X-Tenant-ID header first
    tenantSlug = request.headers['x-tenant-id'];

    // If not in header, try subdomain
    if (!tenantSlug) {
      const host = request.headers.host || '';
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'localhost' && subdomain !== 'api') {
        tenantSlug = subdomain;
      }
    }

    // Resolve the tenant from the authenticated principal. The header/subdomain
    // is only a hint that must match the principal's tenant (SUPER_ADMIN may
    // target any tenant). This prevents a user from switching tenants by
    // spoofing the X-Tenant-ID header.
    const user = request.user;
    if (user) {
      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      const principalTenantId = user.organizationId ?? user.tenantId;

      if (!isSuperAdmin) {
        if (!principalTenantId) {
          throw new ForbiddenException('Authenticated principal is not bound to a tenant');
        }

        if (tenantSlug) {
          const hintedTenant = await this.tenantService.findBySlug(tenantSlug);
          if (!hintedTenant || hintedTenant.id !== principalTenantId) {
            throw new ForbiddenException('Tenant does not match authenticated principal');
          }
        } else {
          const principalTenant = await this.tenantService.findById(principalTenantId);
          if (!principalTenant) {
            throw new ForbiddenException('Tenant does not match authenticated principal');
          }
          tenantSlug = principalTenant.slug;
        }
      }
    }

    if (!tenantSlug) {
      throw new BadRequestException('Tenant identifier not found in request');
    }

    // Get tenant from database
    const tenant = await this.tenantService.findBySlug(tenantSlug);

    if (!tenant || tenant.status !== 'active') {
      throw new BadRequestException('Invalid or inactive tenant');
    }

    // Enforce membership after authentication: the resolved tenant must match
    // the authenticated principal's tenant unless the principal is SUPER_ADMIN.
    if (user && user.role !== 'SUPER_ADMIN') {
      const principalTenantId = user.organizationId ?? user.tenantId;
      if (!principalTenantId || principalTenantId !== tenant.id) {
        throw new ForbiddenException('Tenant does not match authenticated principal');
      }
    }

    const schemaName = `tenant_${tenant.slug}`;
    const routingDataSource = this.tenantDatabaseRoutingService.resolveDataSourceForTenant(
      tenant.region as DataResidencyRegion,
    );

    if (routingDataSource.options.type !== 'sqlite') {
      await routingDataSource.query(`SET search_path TO "${schemaName}", public`);
      await routingDataSource.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenant.id]);
    }

    // Store tenant context using AsyncLocalStorage
    return new Observable((observer) => {
      TenantContext.run(
        {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          schemaName,
          region: tenant.region as DataResidencyRegion,
          strictDataResidency: tenant.strictDataResidency,
        },
        () => {
          next.handle().subscribe({
            next: (value) => observer.next(value),
            error: (err) => observer.error(err),
            complete: () => observer.complete(),
          });
        },
      );
    });
  }
}
