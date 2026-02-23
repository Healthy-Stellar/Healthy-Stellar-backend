import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContext } from '../context/tenant.context';
import { TenantService } from '../services/tenant.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private tenantService: TenantService,
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

    if (!tenantSlug) {
      throw new BadRequestException('Tenant identifier not found in request');
    }

    // Get tenant from database
    const tenant = await this.tenantService.findBySlug(tenantSlug);
    
    if (!tenant || tenant.status !== 'active') {
      throw new BadRequestException('Invalid or inactive tenant');
    }

    const schemaName = `tenant_${tenant.slug}`;
    
    // Set search_path for this connection
    await this.dataSource.query(`SET search_path TO "${schemaName}", public`);

    // Store tenant context using AsyncLocalStorage
    return new Observable((observer) => {
      TenantContext.run(
        {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          schemaName,
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
