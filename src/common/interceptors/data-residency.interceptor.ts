import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContext } from '../../tenant/context/tenant.context';
import { TenantService } from '../../tenant/services/tenant.service';
import { DataResidencyService } from '../../data-residency/services/data-residency.service';
import { DataResidencyRegion } from '../../enums/data-residency.enum';

@Injectable()
export class DataResidencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DataResidencyInterceptor.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
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

    // Verify the current database connection matches the tenant's region
    const currentDbHost = this.dataSource.options.host || 'localhost';
    if (currentDbHost !== regionalConfig.databaseConfig.host) {
      this.logger.warn('Data residency violation detected', {
        tenantId: tenant.id,
        requiredRegion: tenant.region,
        requiredHost: regionalConfig.databaseConfig.host,
        currentHost: currentDbHost,
        operation: method,
      });

      throw new ForbiddenException(
        `Write operation rejected: tenant is restricted to ${tenant.region} data center. ` +
          `Connected to ${currentDbHost}, but required ${regionalConfig.databaseConfig.host}.`,
      );
    }

    // Log successful residency check
    this.logger.debug('Data residency check passed', {
      tenantId: tenant.id,
      region: tenant.region,
      host: currentDbHost,
      operation: method,
    });

    return next.handle();
  }
}
