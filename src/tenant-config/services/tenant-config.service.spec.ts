import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { TenantConfigService } from './tenant-config.service';
import { TenantConfig, ConfigValueType } from '../entities/tenant-config.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import {
  SUPPORTED_CONFIG_KEYS,
  DEFAULT_CONFIG_VALUES,
  GLOBAL_TENANT_ID,
} from '../constants/config-keys.constant';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

describe('TenantConfigService', () => {
  let service: TenantConfigService;
  let repository: Repository<TenantConfig>;
  let auditLogService: AuditLogService;
  let configService: ConfigService;

  const mockTenantId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockAuditLogService = {
    create: jest.fn().mockResolvedValue({}),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: '',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantConfigService,
        {
          provide: getRepositoryToken(TenantConfig),
          useValue: mockRepository,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TenantConfigService>(TenantConfigService);
    repository = module.get<Repository<TenantConfig>>(
      getRepositoryToken(TenantConfig),
    );
    auditLogService = module.get<AuditLogService>(AuditLogService);
    configService = module.get<ConfigService>(ConfigService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return tenant-specific config when available', async () => {
      const mockConfig: Partial<TenantConfig> = {
        id: '1',
        tenantId: mockTenantId,
        key: SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
        value: '365',
        valueType: ConfigValueType.NUMBER,
      };

      mockRepository.findOne.mockResolvedValueOnce(mockConfig);

      const result = await service.get(
        mockTenantId,
        SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
      );

      expect(result).toBe(365);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId, key: SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS },
      });
    });

    it('should fallback to global default when tenant config not found', async () => {
      const mockGlobalConfig: Partial<TenantConfig> = {
        id: '2',
        tenantId: GLOBAL_TENANT_ID,
        key: SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
        value: '2555',
        valueType: ConfigValueType.NUMBER,
      };

      mockRepository.findOne
        .mockResolvedValueOnce(null) // Tenant config not found
        .mockResolvedValueOnce(mockGlobalConfig); // Global config found

      const result = await service.get(
        mockTenantId,
        SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
      );

      expect(result).toBe(2555);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should fallback to hardcoded default when no config found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.get(
        mockTenantId,
        SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
      );

      expect(result).toBe(DEFAULT_CONFIG_VALUES[SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS]);
    });

    it('should parse boolean values correctly', async () => {
      const mockConfig: Partial<TenantConfig> = {
        id: '3',
        tenantId: mockTenantId,
        key: SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
        value: 'true',
        valueType: ConfigValueType.BOOLEAN,
      };

      mockRepository.findOne.mockResolvedValueOnce(mockConfig);

      const result = await service.get(
        mockTenantId,
        SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
      );

      expect(result).toBe(true);
    });

    it('should parse JSON values correctly', async () => {
      const mockConfig: Partial<TenantConfig> = {
        id: '4',
        tenantId: mockTenantId,
        key: SUPPORTED_CONFIG_KEYS.ALLOWED_RECORD_TYPES,
        value: '["medical_record","lab_result"]',
        valueType: ConfigValueType.JSON,
      };

      mockRepository.findOne.mockResolvedValueOnce(mockConfig);

      const result = await service.get(
        mockTenantId,
        SUPPORTED_CONFIG_KEYS.ALLOWED_RECORD_TYPES,
      );

      expect(result).toEqual(['medical_record', 'lab_result']);
    });
  });

  describe('set', () => {
    it('should create new config when not exists', async () => {
      const mockConfig: Partial<TenantConfig> = {
        id: '5',
        tenantId: mockTenantId,
        key: SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB,
        value: '100',
        valueType: ConfigValueType.NUMBER,
        updatedBy: mockUserId,
      };

      mockRepository.findOne.mockResolvedValueOnce(null);
      mockRepository.create.mockReturnValue(mockConfig);
      mockRepository.save.mockResolvedValue(mockConfig);

      const result = await service.set(
        mockTenantId,
        SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB,
        100,
        mockUserId,
      );

      expect(result).toEqual(mockConfig);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(auditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'CREATE_TENANT_CONFIG',
          entityType: 'tenant_config',
          userId: mockUserId,
        }),
      );
    });

    it('should update existing config', async () => {
      const existingConfig: Partial<TenantConfig> = {
        id: '6',
        tenantId: mockTenantId,
        key: SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB,
        value: '50',
        valueType: ConfigValueType.NUMBER,
      };

      const updatedConfig = { ...existingConfig, value: '100', updatedBy: mockUserId };

      mockRepository.findOne.mockResolvedValueOnce(existingConfig);
      mockRepository.save.mockResolvedValue(updatedConfig);

      const result = await service.set(
        mockTenantId,
        SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB,
        100,
        mockUserId,
      );

      expect(result.value).toBe('100');
      expect(auditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'UPDATE_TENANT_CONFIG',
          oldValues: { [SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB]: '50' },
          newValues: { [SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB]: '100' },
        }),
      );
    });

    it('should throw BadRequestException for unsupported key', async () => {
      await expect(
        service.set(mockTenantId, 'invalid_key', 'value', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle boolean values correctly', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({
        value: 'false',
        valueType: ConfigValueType.BOOLEAN,
      });

      await service.set(
        mockTenantId,
        SUPPORTED_CONFIG_KEYS.EMERGENCY_ACCESS_ENABLED,
        false,
        mockUserId,
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'false',
          valueType: ConfigValueType.BOOLEAN,
        }),
      );
    });

    it('should handle array values correctly', async () => {
      const arrayValue = ['type1', 'type2', 'type3'];
      
      mockRepository.findOne.mockResolvedValueOnce(null);
      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({
        value: JSON.stringify(arrayValue),
        valueType: ConfigValueType.ARRAY,
      });

      await service.set(
        mockTenantId,
        SUPPORTED_CONFIG_KEYS.ALLOWED_RECORD_TYPES,
        arrayValue,
        mockUserId,
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          value: JSON.stringify(arrayValue),
          valueType: ConfigValueType.ARRAY,
        }),
      );
    });
  });

  describe('delete', () => {
    it('should delete config and audit the change', async () => {
      const mockConfig: Partial<TenantConfig> = {
        id: '7',
        tenantId: mockTenantId,
        key: SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB,
        value: '100',
      };

      mockRepository.findOne.mockResolvedValueOnce(mockConfig);
      mockRepository.remove.mockResolvedValue(mockConfig);

      await service.delete(mockTenantId, SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB, mockUserId);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockConfig);
      expect(auditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'DELETE_TENANT_CONFIG',
          entityType: 'tenant_config',
          userId: mockUserId,
          oldValues: { [SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB]: '100' },
        }),
      );
    });

    it('should throw NotFoundException when config not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.delete(mockTenantId, SUPPORTED_CONFIG_KEYS.MAX_RECORD_SIZE_MB, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true when feature is enabled', async () => {
      const mockConfig: Partial<TenantConfig> = {
        tenantId: mockTenantId,
        key: SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
        value: 'true',
        valueType: ConfigValueType.BOOLEAN,
      };

      mockRepository.findOne.mockResolvedValueOnce(mockConfig);

      const result = await service.isFeatureEnabled(
        mockTenantId,
        SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
      );

      expect(result).toBe(true);
    });

    it('should return false when feature is disabled', async () => {
      const mockConfig: Partial<TenantConfig> = {
        tenantId: mockTenantId,
        key: SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
        value: 'false',
        valueType: ConfigValueType.BOOLEAN,
      };

      mockRepository.findOne.mockResolvedValueOnce(mockConfig);

      const result = await service.isFeatureEnabled(
        mockTenantId,
        SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
      );

      expect(result).toBe(false);
    });
  });

  describe('getMultiple', () => {
    it('should return multiple config values', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce({
          key: SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
          value: '365',
          valueType: ConfigValueType.NUMBER,
        })
        .mockResolvedValueOnce({
          key: SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
          value: 'true',
          valueType: ConfigValueType.BOOLEAN,
        });

      const result = await service.getMultiple(mockTenantId, [
        SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
        SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
      ]);

      expect(result).toEqual({
        [SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS]: 365,
        [SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED]: true,
      });
    });
  });

  describe('getAllForTenant', () => {
    it('should return all configs for a tenant', async () => {
      const mockConfigs: Partial<TenantConfig>[] = [
        {
          id: '1',
          tenantId: mockTenantId,
          key: SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
          value: '365',
        },
        {
          id: '2',
          tenantId: mockTenantId,
          key: SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
          value: 'true',
        },
      ];

      mockRepository.find.mockResolvedValue(mockConfigs);

      const result = await service.getAllForTenant(mockTenantId);

      expect(result).toEqual(mockConfigs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId },
        order: { key: 'ASC' },
      });
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple configs', async () => {
      const configs = [
        {
          key: SUPPORTED_CONFIG_KEYS.AUDIT_RETENTION_DAYS,
          value: '365',
          valueType: ConfigValueType.NUMBER,
        },
        {
          key: SUPPORTED_CONFIG_KEYS.FHIR_EXPORT_ENABLED,
          value: 'false',
          valueType: ConfigValueType.BOOLEAN,
        },
      ];

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      const result = await service.bulkUpdate(mockTenantId, configs, mockUserId);

      expect(result).toHaveLength(2);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
      expect(auditLogService.create).toHaveBeenCalledTimes(2);
    });
  });
});
