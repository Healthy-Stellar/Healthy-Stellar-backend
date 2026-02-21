import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { TenantConfig, ConfigValueType } from '../entities/tenant-config.entity';
import { UpdateTenantConfigDto } from '../dto/update-tenant-config.dto';
import {
  SUPPORTED_CONFIG_KEYS,
  DEFAULT_CONFIG_VALUES,
  GLOBAL_TENANT_ID,
  TENANT_CONFIG_CACHE_TTL,
  TENANT_CONFIG_CACHE_PREFIX,
} from '../constants/config-keys.constant';
import { AuditLogService } from '../../common/services/audit-log.service';

@Injectable()
export class TenantConfigService {
  private readonly logger = new Logger(TenantConfigService.name);
  private redisClient: Redis;

  constructor(
    @InjectRepository(TenantConfig)
    private readonly tenantConfigRepository: Repository<TenantConfig>,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {
    // Initialize Redis client
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    if (redisUrl) {
      this.redisClient = new Redis(redisUrl);
    } else {
      this.redisClient = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    }

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  /**
   * Get configuration value with fallback to global defaults and environment variables
   * Resolution order: tenant override → global default → environment variable
   */
  async get<T = any>(tenantId: string, key: string): Promise<T> {
    // Check cache first
    const cacheKey = this.getCacheKey(tenantId, key);
    const cachedValue = await this.getFromCache(cacheKey);
    
    if (cachedValue !== null) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cachedValue as T;
    }

    // Try tenant-specific config
    const tenantConfig = await this.tenantConfigRepository.findOne({
      where: { tenantId, key },
    });

    if (tenantConfig) {
      const parsedValue = this.parseConfigValue(tenantConfig.value, tenantConfig.valueType);
      await this.setCache(cacheKey, parsedValue);
      return parsedValue as T;
    }

    // Try global default from database
    const globalConfig = await this.tenantConfigRepository.findOne({
      where: { tenantId: GLOBAL_TENANT_ID, key },
    });

    if (globalConfig) {
      const parsedValue = this.parseConfigValue(globalConfig.value, globalConfig.valueType);
      await this.setCache(cacheKey, parsedValue);
      return parsedValue as T;
    }

    // Fallback to hardcoded defaults
    if (key in DEFAULT_CONFIG_VALUES) {
      const defaultValue = DEFAULT_CONFIG_VALUES[key];
      await this.setCache(cacheKey, defaultValue);
      return defaultValue as T;
    }

    // Final fallback to environment variable
    const envValue = this.configService.get<string>(key.toUpperCase());
    if (envValue !== undefined) {
      const parsedEnvValue = this.parseEnvValue(envValue);
      await this.setCache(cacheKey, parsedEnvValue);
      return parsedEnvValue as T;
    }

    this.logger.warn(`Configuration key "${key}" not found for tenant ${tenantId}`);
    return null;
  }

  /**
   * Get multiple configuration values at once
   */
  async getMultiple(tenantId: string, keys: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    
    await Promise.all(
      keys.map(async (key) => {
        result[key] = await this.get(tenantId, key);
      }),
    );

    return result;
  }

  /**
   * Get all configurations for a tenant
   */
  async getAllForTenant(tenantId: string): Promise<TenantConfig[]> {
    return this.tenantConfigRepository.find({
      where: { tenantId },
      order: { key: 'ASC' },
    });
  }

  /**
   * Update or create tenant configuration
   */
  async set(
    tenantId: string,
    key: string,
    value: any,
    userId: string,
    valueType?: ConfigValueType,
  ): Promise<TenantConfig> {
    // Validate tenant ID format (UUID)
    if (!this.isValidUUID(tenantId)) {
      throw new BadRequestException('Invalid tenant ID format');
    }

    // Validate key is supported
    const supportedKeys = Object.values(SUPPORTED_CONFIG_KEYS);
    if (!supportedKeys.includes(key)) {
      throw new BadRequestException(
        `Unsupported configuration key: ${key}. Supported keys: ${supportedKeys.join(', ')}`,
      );
    }

    // Sanitize value to prevent injection attacks
    const sanitizedValue = this.sanitizeConfigValue(value);

    // Get old value for audit
    const existingConfig = await this.tenantConfigRepository.findOne({
      where: { tenantId, key },
    });

    const oldValue = existingConfig ? existingConfig.value : null;
    const stringValue = this.stringifyConfigValue(sanitizedValue);
    const detectedType = valueType || this.detectValueType(sanitizedValue);

    let config: TenantConfig;

    if (existingConfig) {
      // Update existing
      existingConfig.value = stringValue;
      existingConfig.valueType = detectedType;
      existingConfig.updatedBy = userId;
      config = await this.tenantConfigRepository.save(existingConfig);
    } else {
      // Create new
      config = this.tenantConfigRepository.create({
        tenantId,
        key,
        value: stringValue,
        valueType: detectedType,
        updatedBy: userId,
      });
      config = await this.tenantConfigRepository.save(config);
    }

    // Invalidate cache
    await this.invalidateCache(tenantId, key);

    // Audit log with sanitized values
    await this.auditLogService.create({
      operation: existingConfig ? 'UPDATE_TENANT_CONFIG' : 'CREATE_TENANT_CONFIG',
      entityType: 'tenant_config',
      entityId: config.id,
      userId,
      oldValues: oldValue ? { [key]: this.sanitizeForAudit(oldValue) } : undefined,
      newValues: { [key]: this.sanitizeForAudit(stringValue) },
      status: 'success',
    });

    this.logger.log(
      `Tenant config updated: tenant=${this.sanitizeForLog(tenantId)}, key=${key}`,
    );

    return config;
  }

  /**
   * Validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Sanitize configuration value to prevent injection
   */
  private sanitizeConfigValue(value: any): any {
    if (typeof value === 'string') {
      // Remove control characters and limit length
      return value.replace(/[\x00-\x1F\x7F]/g, '').substring(0, 10000);
    }
    return value;
  }

  /**
   * Sanitize value for audit logs to prevent log injection
   */
  private sanitizeForAudit(value: string): string {
    if (!value) return '';
    // Remove newlines and control characters
    return value.replace(/[\r\n\x00-\x1F\x7F]/g, ' ').substring(0, 1000);
  }

  /**
   * Sanitize value for logging
   */
  private sanitizeForLog(value: string): string {
    if (!value) return '';
    // Remove newlines and limit length
    return value.replace(/[\r\n]/g, ' ').substring(0, 100);
  }

  /**
   * Bulk update tenant configurations
   */
  async bulkUpdate(
    tenantId: string,
    configs: UpdateTenantConfigDto[],
    userId: string,
  ): Promise<TenantConfig[]> {
    const results: TenantConfig[] = [];

    for (const configDto of configs) {
      const result = await this.set(
        tenantId,
        configDto.key,
        configDto.value,
        userId,
        configDto.valueType,
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Delete tenant configuration (revert to default)
   */
  async delete(tenantId: string, key: string, userId: string): Promise<void> {
    const config = await this.tenantConfigRepository.findOne({
      where: { tenantId, key },
    });

    if (!config) {
      throw new NotFoundException(`Configuration not found: ${key} for tenant ${tenantId}`);
    }

    await this.tenantConfigRepository.remove(config);
    await this.invalidateCache(tenantId, key);

    // Audit log
    await this.auditLogService.create({
      operation: 'DELETE_TENANT_CONFIG',
      entityType: 'tenant_config',
      entityId: config.id,
      userId,
      oldValues: { [key]: config.value },
      status: 'success',
    });

    this.logger.log(`Tenant config deleted: tenant=${tenantId}, key=${key}`);
  }

  /**
   * Check if a feature is enabled for a tenant
   */
  async isFeatureEnabled(tenantId: string, featureKey: string): Promise<boolean> {
    const value = await this.get<boolean>(tenantId, featureKey);
    return value === true;
  }

  // Private helper methods

  /**
   * Generate cache key with sanitization to prevent Redis injection
   * Protects against CRLF injection and command injection
   */
  private getCacheKey(tenantId: string, key: string): string {
    // Sanitize inputs to prevent Redis command injection
    const sanitizedTenantId = this.sanitizeRedisKey(tenantId);
    const sanitizedKey = this.sanitizeRedisKey(key);
    return `${TENANT_CONFIG_CACHE_PREFIX}${sanitizedTenantId}:${sanitizedKey}`;
  }

  /**
   * Sanitize Redis key to prevent injection attacks
   * Removes: \r, \n, spaces, and special characters
   */
  private sanitizeRedisKey(input: string): string {
    if (!input) return '';
    // Remove CRLF, spaces, and allow only alphanumeric, dash, underscore
    return input.replace(/[\r\n\s]/g, '').replace(/[^a-zA-Z0-9\-_]/g, '_');
  }

  private async getFromCache(key: string): Promise<any> {
    try {
      const cached = await this.redisClient.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Verify cache integrity with checksum
        if (this.verifyCacheIntegrity(parsed)) {
          return parsed.data;
        } else {
          this.logger.warn(`Cache integrity check failed for ${key}, invalidating`);
          await this.redisClient.del(key);
          return null;
        }
      }
    } catch (error) {
      this.logger.error(`Cache read error for ${key}:`, error);
    }
    return null;
  }

  private async setCache(key: string, value: any): Promise<void> {
    try {
      // Add integrity checksum to cached value
      const cacheData = {
        data: value,
        checksum: this.generateChecksum(value),
        timestamp: Date.now(),
      };
      await this.redisClient.setex(
        key,
        TENANT_CONFIG_CACHE_TTL,
        JSON.stringify(cacheData),
      );
    } catch (error) {
      this.logger.error(`Cache write error for ${key}:`, error);
    }
  }

  /**
   * Generate checksum for cache integrity verification
   */
  private generateChecksum(data: any): string {
    const crypto = require('crypto');
    const str = JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Verify cache integrity using checksum
   */
  private verifyCacheIntegrity(cacheData: any): boolean {
    if (!cacheData || !cacheData.data || !cacheData.checksum) {
      return false;
    }
    const expectedChecksum = this.generateChecksum(cacheData.data);
    return expectedChecksum === cacheData.checksum;
  }

  private async invalidateCache(tenantId: string, key: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(tenantId, key);
      await this.redisClient.del(cacheKey);
      this.logger.debug(`Cache invalidated for ${cacheKey}`);
    } catch (error) {
      this.logger.error(`Cache invalidation error:`, error);
    }
  }

  private parseConfigValue(value: string, type: ConfigValueType): any {
    try {
      switch (type) {
        case ConfigValueType.NUMBER:
          return parseFloat(value);
        case ConfigValueType.BOOLEAN:
          return value === 'true' || value === '1';
        case ConfigValueType.JSON:
        case ConfigValueType.ARRAY:
          return JSON.parse(value);
        case ConfigValueType.STRING:
        default:
          return value;
      }
    } catch (error) {
      this.logger.error(`Error parsing config value: ${value}`, error);
      return value;
    }
  }

  private stringifyConfigValue(value: any): string {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private detectValueType(value: any): ConfigValueType {
    if (typeof value === 'number') return ConfigValueType.NUMBER;
    if (typeof value === 'boolean') return ConfigValueType.BOOLEAN;
    if (Array.isArray(value)) return ConfigValueType.ARRAY;
    if (typeof value === 'object') return ConfigValueType.JSON;
    return ConfigValueType.STRING;
  }

  private parseEnvValue(value: string): any {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Try to parse as number
      if (!isNaN(Number(value))) {
        return Number(value);
      }
      // Try to parse as boolean
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
      // Return as string
      return value;
    }
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }
}
