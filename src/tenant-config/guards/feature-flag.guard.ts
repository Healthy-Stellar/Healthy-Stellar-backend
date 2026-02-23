import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantConfigService } from '../services/tenant-config.service';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  private readonly logger = new Logger(FeatureFlagGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tenantConfigService: TenantConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.get<string>(
      REQUIRE_FEATURE_KEY,
      context.getHandler(),
    );

    if (!requiredFeature) {
      // No feature requirement, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = this.extractTenantId(request);

    if (!tenantId) {
      this.logger.warn('No tenant ID found in request');
      // Add constant-time delay to prevent timing attacks
      await this.constantTimeDelay();
      throw new ForbiddenException('Tenant identification required');
    }

    try {
      const isEnabled = await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        requiredFeature,
      );

      if (!isEnabled) {
        this.logger.warn(
          `Feature "${requiredFeature}" is disabled for tenant`,
        );
        // Add constant-time delay to prevent timing attacks
        await this.constantTimeDelay();
        throw new ForbiddenException(
          `Feature "${requiredFeature}" is not enabled for your organization`,
        );
      }

      this.logger.debug(
        `Feature "${requiredFeature}" check passed for tenant`,
      );
      
      // Add constant-time delay to prevent timing attacks
      await this.constantTimeDelay();
      return true;
    } catch (error) {
      // Add constant-time delay to prevent timing attacks
      await this.constantTimeDelay();
      
      if (error instanceof ForbiddenException) {
        throw error;
      }
      
      this.logger.error(`Error checking feature: ${error.message}`);
      throw new ForbiddenException('Feature check failed');
    }
  }

  /**
   * Constant-time delay to prevent timing attacks
   * Adds a small random delay to make timing analysis harder
   */
  private async constantTimeDelay(): Promise<void> {
    // Add 5-15ms random delay to prevent timing analysis
    const delay = 5 + Math.random() * 10;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Extract tenant ID from request
   * Priority: 1. URL param, 2. Query param, 3. Header, 4. User object
   */
  private extractTenantId(request: any): string | null {
    // From URL params (e.g., /admin/tenants/:id/config)
    if (request.params?.id) {
      return request.params.id;
    }

    if (request.params?.tenantId) {
      return request.params.tenantId;
    }

    // From query params
    if (request.query?.tenantId) {
      return request.query.tenantId;
    }

    // From custom header
    if (request.headers['x-tenant-id']) {
      return request.headers['x-tenant-id'];
    }

    // From authenticated user (if user has tenantId property)
    if (request.user?.tenantId) {
      return request.user.tenantId;
    }

    // From authenticated user's organization
    if (request.user?.organizationId) {
      return request.user.organizationId;
    }

    return null;
  }
}
