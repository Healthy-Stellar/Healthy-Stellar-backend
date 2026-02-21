import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TenantConfigService } from '../services/tenant-config.service';
import { UpdateTenantConfigDto, BulkUpdateTenantConfigDto } from '../dto/update-tenant-config.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';

@Controller('admin/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
export class TenantConfigController {
  private readonly logger = new Logger(TenantConfigController.name);

  constructor(private readonly tenantConfigService: TenantConfigService) {}

  /**
   * Get all configurations for a tenant
   * GET /admin/tenants/:id/config
   */
  @Get(':id/config')
  @Roles(UserRole.ADMIN)
  async getTenantConfig(@Param('id', ParseUUIDPipe) tenantId: string, @Request() req) {
    // Validate tenant access (prevent IDOR)
    this.validateTenantAccess(req.user, tenantId);
    
    this.logger.log(`Fetching config for tenant: ${this.sanitizeTenantId(tenantId)}`);
    
    try {
      const configs = await this.tenantConfigService.getAllForTenant(tenantId);
      
      return {
        tenantId,
        configs: configs.map((config) => ({
          key: config.key,
          value: config.value,
          valueType: config.valueType,
          description: config.description,
          updatedAt: config.updatedAt,
          updatedBy: config.updatedBy,
        })),
      };
    } catch (error) {
      // Generic error message to prevent information disclosure
      this.logger.error(`Error fetching tenant config: ${error.message}`);
      throw new NotFoundException('Configuration not found');
    }
  }

  /**
   * Get a specific configuration value for a tenant
   * GET /admin/tenants/:id/config/:key
   */
  @Get(':id/config/:key')
  @Roles(UserRole.ADMIN)
  async getTenantConfigByKey(
    @Param('id', ParseUUIDPipe) tenantId: string,
    @Param('key') key: string,
    @Request() req,
  ) {
    this.validateTenantAccess(req.user, tenantId);
    this.validateConfigKey(key);
    
    this.logger.log(`Fetching config key "${key}" for tenant: ${this.sanitizeTenantId(tenantId)}`);
    
    try {
      const value = await this.tenantConfigService.get(tenantId, key);
      
      return {
        tenantId,
        key,
        value,
      };
    } catch (error) {
      this.logger.error(`Error fetching config key: ${error.message}`);
      throw new NotFoundException('Configuration not found');
    }
  }

  /**
   * Update tenant configuration
   * PATCH /admin/tenants/:id/config
   */
  @Patch(':id/config')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // Stricter limit for updates: 20 per minute
  async updateTenantConfig(
    @Param('id', ParseUUIDPipe) tenantId: string,
    @Body() updateDto: UpdateTenantConfigDto,
    @Request() req,
  ) {
    this.validateTenantAccess(req.user, tenantId);
    this.validateConfigKey(updateDto.key);
    
    const userId = req.user?.userId || req.user?.id;
    
    this.logger.log(
      `Updating config for tenant ${this.sanitizeTenantId(tenantId)}: ${updateDto.key}`,
    );

    try {
      const config = await this.tenantConfigService.set(
        tenantId,
        updateDto.key,
        updateDto.value,
        userId,
        updateDto.valueType,
      );

      return {
        message: 'Configuration updated successfully',
        config: {
          key: config.key,
          value: config.value,
          valueType: config.valueType,
          updatedAt: config.updatedAt,
        },
      };
    } catch (error) {
      this.logger.error(`Error updating config: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update configuration');
    }
  }

  /**
   * Bulk update tenant configurations
   * PATCH /admin/tenants/:id/config/bulk
   */
  @Patch(':id/config/bulk')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // Even stricter for bulk: 10 per minute
  async bulkUpdateTenantConfig(
    @Param('id', ParseUUIDPipe) tenantId: string,
    @Body() bulkUpdateDto: BulkUpdateTenantConfigDto,
    @Request() req,
  ) {
    this.validateTenantAccess(req.user, tenantId);
    
    // Validate all keys before processing
    bulkUpdateDto.configs.forEach(config => this.validateConfigKey(config.key));
    
    // Limit bulk update size
    if (bulkUpdateDto.configs.length > 50) {
      throw new BadRequestException('Bulk update limited to 50 configurations at once');
    }
    
    const userId = req.user?.userId || req.user?.id;
    
    this.logger.log(
      `Bulk updating ${bulkUpdateDto.configs.length} configs for tenant ${this.sanitizeTenantId(tenantId)}`,
    );

    try {
      const configs = await this.tenantConfigService.bulkUpdate(
        tenantId,
        bulkUpdateDto.configs,
        userId,
      );

      return {
        message: 'Configurations updated successfully',
        count: configs.length,
        configs: configs.map((config) => ({
          key: config.key,
          value: config.value,
          valueType: config.valueType,
          updatedAt: config.updatedAt,
        })),
      };
    } catch (error) {
      this.logger.error(`Error in bulk update: ${error.message}`);
      throw new BadRequestException('Failed to update configurations');
    }
  }

  /**
   * Delete tenant configuration (revert to default)
   * DELETE /admin/tenants/:id/config/:key
   */
  @Delete(':id/config/:key')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 deletes per minute
  async deleteTenantConfig(
    @Param('id', ParseUUIDPipe) tenantId: string,
    @Param('key') key: string,
    @Request() req,
  ) {
    this.validateTenantAccess(req.user, tenantId);
    this.validateConfigKey(key);
    
    const userId = req.user?.userId || req.user?.id;
    
    this.logger.log(`Deleting config key "${key}" for tenant: ${this.sanitizeTenantId(tenantId)}`);
    
    try {
      await this.tenantConfigService.delete(tenantId, key, userId);

      return {
        message: 'Configuration deleted successfully (reverted to default)',
        tenantId,
        key,
      };
    } catch (error) {
      this.logger.error(`Error deleting config: ${error.message}`);
      throw new NotFoundException('Configuration not found');
    }
  }

  /**
   * Check if a feature is enabled for a tenant
   * GET /admin/tenants/:id/features/:featureKey
   */
  @Get(':id/features/:featureKey')
  @Roles(UserRole.ADMIN)
  async checkFeature(
    @Param('id', ParseUUIDPipe) tenantId: string,
    @Param('featureKey') featureKey: string,
    @Request() req,
  ) {
    this.validateTenantAccess(req.user, tenantId);
    this.validateConfigKey(featureKey);
    
    this.logger.log(`Checking feature "${featureKey}" for tenant: ${this.sanitizeTenantId(tenantId)}`);
    
    try {
      const isEnabled = await this.tenantConfigService.isFeatureEnabled(
        tenantId,
        featureKey,
      );

      return {
        tenantId,
        featureKey,
        enabled: isEnabled,
      };
    } catch (error) {
      this.logger.error(`Error checking feature: ${error.message}`);
      throw new NotFoundException('Feature not found');
    }
  }

  /**
   * Validate tenant access to prevent IDOR attacks
   * In production, implement proper tenant isolation based on user's organization
   */
  private validateTenantAccess(user: any, tenantId: string): void {
    // TODO: Implement proper tenant isolation
    // For now, only admins can access any tenant
    // In production, check if user belongs to the tenant's organization
    
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }

    // Example: if (user.tenantId && user.tenantId !== tenantId) {
    //   throw new ForbiddenException('Access denied to this tenant');
    // }
  }

  /**
   * Validate configuration key to prevent injection
   */
  private validateConfigKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Invalid configuration key');
    }

    // Only allow alphanumeric, underscore, and dash
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      throw new BadRequestException('Invalid configuration key format');
    }

    // Limit key length
    if (key.length > 255) {
      throw new BadRequestException('Configuration key too long');
    }
  }

  /**
   * Sanitize tenant ID for logging (prevent log injection)
   */
  private sanitizeTenantId(tenantId: string): string {
    return tenantId.replace(/[^a-zA-Z0-9-]/g, '');
  }
}
