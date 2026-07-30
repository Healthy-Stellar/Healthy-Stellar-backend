import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from '../../tenant/context/tenant.context';
import { TenantService } from '../../tenant/services/tenant.service';
import { DataResidencyService } from '../../data-residency/services/data-residency.service';

@Injectable()
export class DataResidencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DataResidencyInterceptor.name);

  constructor(
    private tenantService: TenantService,
    private dataResidencyService: DataResidencyService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // Only enforce on write operations (POST, PUT, PATCH, DELETE)
    const method = request.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const tenantContext = TenantContext.get();
    if (!tenantContext) {
      throw new ForbiddenException('Tenant context not found');
    }

    // Get tenant with residency policy
    const tenant = await this.tenantService.findById(tenantContext.tenantId);
    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    // Check if strict data residency is enforced
    if (!tenant.strictDataResidency) {
      return next.handle();
    }

    // Get the regional database config for this tenant's region
    const regionalConfig = this.dataResidencyService.getRegionalConfig(tenant.region);
    if (!regionalConfig) {
      throw new ForbiddenException(
        `Regional infrastructure not configured for region: ${tenant.region}`,
      );
    }

    this.logger.debug('Data residency check passed', {
      tenantId: tenant.id,
      region: tenant.region,
      operation: method,
    });

    return next.handle();
  }
}
