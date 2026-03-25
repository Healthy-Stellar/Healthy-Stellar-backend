import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyService } from '../../../src/auth/services/api-key.service';
import { ApiKey, ApiKeyScope } from '../../../src/auth/entities/api-key.entity';
import { User } from '../../../src/auth/entities/user.entity';
import { AuditService } from '../../../src/common/audit/audit.service';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let apiKeyRepository: Repository<ApiKey>;
  let userRepository: Repository<User>;
  let auditService: AuditService;

  const mockApiKeyRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockAuditService = {
    logAction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockApiKeyRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
    apiKeyRepository = module.get<Repository<ApiKey>>(getRepositoryToken(ApiKey));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createApiKey', () => {
    it('should create a new API key successfully', async () => {
      const createDto = {
        name: 'Test API Key',
        description: 'For testing',
        scopes: [ApiKeyScope.READ_RECORDS],
      };
      const createdById = 'user-123';
      const ipAddress = '127.0.0.1';
      const userAgent = 'test-agent';

      const mockUser = {
        id: createdById,
        email: 'admin@test.com',
        firstName: 'Admin',
        lastName: 'User',
      };

      const mockApiKey = {
        id: 'key-123',
        name: createDto.name,
        description: createDto.description,
        keyHash: 'mock-hash',
        scopes: createDto.scopes,
        isActive: true,
        createdBy: mockUser,
        createdById,
        createdAt: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockApiKeyRepository.findOne.mockResolvedValue(null); // No existing key
      mockApiKeyRepository.create.mockReturnValue(mockApiKey);
      mockApiKeyRepository.save.mockResolvedValue(mockApiKey);

      const result = await service.createApiKey(createDto, createdById, ipAddress, userAgent);

      expect(result).toHaveProperty('key');
      expect(result.id).toBe('key-123');
      expect(result.name).toBe(createDto.name);
      expect(result.scopes).toEqual(createDto.scopes);
      expect(mockAuditService.logAction).toHaveBeenCalledWith(
        'API_KEY_CREATED',
        createdById,
        expect.stringContaining('API key "Test API Key" created'),
        expect.any(Object),
        ipAddress,
        userAgent,
      );
    });

    it('should throw error if API key name already exists', async () => {
      const createDto = {
        name: 'Existing Key',
        description: 'For testing',
        scopes: [ApiKeyScope.READ_RECORDS],
      };

      mockApiKeyRepository.findOne.mockResolvedValue({ id: 'existing-key' });

      await expect(
        service.createApiKey(createDto, 'user-123', '127.0.0.1', 'test-agent'),
      ).rejects.toThrow('API key with this name already exists');
    });
  });

  describe('validateApiKey', () => {
    it('should validate a correct API key', async () => {
      const rawKey = 'test-api-key-123';
      const keyHash = 'mock-hash-from-key';
      const mockApiKey = {
        id: 'key-123',
        keyHash,
        isActive: true,
        scopes: [ApiKeyScope.READ_RECORDS],
      };

      // Mock the hashApiKey method
      jest.spyOn(service as any, 'hashApiKey').mockReturnValue(keyHash);
      mockApiKeyRepository.findOne.mockResolvedValue(mockApiKey);

      const result = await service.validateApiKey(rawKey);

      expect(result).toEqual(mockApiKey);
      expect(mockApiKeyRepository.update).toHaveBeenCalledWith('key-123', {
        lastUsedAt: expect.any(Date),
      });
    });

    it('should return null for invalid API key', async () => {
      const rawKey = 'invalid-key';
      const keyHash = 'invalid-hash';

      jest.spyOn(service as any, 'hashApiKey').mockReturnValue(keyHash);
      mockApiKeyRepository.findOne.mockResolvedValue(null);

      const result = await service.validateApiKey(rawKey);

      expect(result).toBeNull();
    });

    it('should return null for inactive API key', async () => {
      const rawKey = 'inactive-key';
      const keyHash = 'inactive-hash';
      const mockApiKey = {
        id: 'key-123',
        keyHash,
        isActive: false,
      };

      jest.spyOn(service as any, 'hashApiKey').mockReturnValue(keyHash);
      mockApiKeyRepository.findOne.mockResolvedValue(mockApiKey);

      const result = await service.validateApiKey(rawKey);

      expect(result).toBeNull();
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an active API key', async () => {
      const apiKeyId = 'key-123';
      const revokedById = 'user-456';
      const ipAddress = '127.0.0.1';
      const userAgent = 'test-agent';

      const mockApiKey = {
        id: apiKeyId,
        name: 'Test Key',
        isActive: true,
        createdBy: { id: 'user-123' },
      };

      mockApiKeyRepository.findOne.mockResolvedValue(mockApiKey);

      await service.revokeApiKey(apiKeyId, revokedById, ipAddress, userAgent);

      expect(mockApiKeyRepository.update).toHaveBeenCalledWith(apiKeyId, {
        isActive: false,
        updatedAt: expect.any(Date),
      });
      expect(mockAuditService.logAction).toHaveBeenCalledWith(
        'API_KEY_REVOKED',
        revokedById,
        'API key "Test Key" revoked',
        { apiKeyId },
        ipAddress,
        userAgent,
      );
    });

    it('should throw error if API key not found', async () => {
      mockApiKeyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.revokeApiKey('non-existent', 'user-123', '127.0.0.1', 'test-agent'),
      ).rejects.toThrow('API key not found');
    });

    it('should throw error if API key already revoked', async () => {
      const mockApiKey = {
        id: 'key-123',
        isActive: false,
      };

      mockApiKeyRepository.findOne.mockResolvedValue(mockApiKey);

      await expect(
        service.revokeApiKey('key-123', 'user-123', '127.0.0.1', 'test-agent'),
      ).rejects.toThrow('API key is already revoked');
    });
  });

  describe('hasScope', () => {
    it('should return true if API key has the required scope', () => {
      const apiKey = {
        scopes: [ApiKeyScope.READ_RECORDS, ApiKeyScope.WRITE_RECORDS],
      } as ApiKey;

      expect(service.hasScope(apiKey, ApiKeyScope.READ_RECORDS)).toBe(true);
      expect(service.hasScope(apiKey, ApiKeyScope.WRITE_RECORDS)).toBe(true);
      expect(service.hasScope(apiKey, ApiKeyScope.READ_PATIENTS)).toBe(false);
    });
  });

  describe('hasAnyScope', () => {
    it('should return true if API key has any of the required scopes', () => {
      const apiKey = {
        scopes: [ApiKeyScope.READ_RECORDS],
      } as ApiKey;

      expect(service.hasAnyScope(apiKey, [ApiKeyScope.READ_RECORDS, ApiKeyScope.WRITE_RECORDS])).toBe(true);
      expect(service.hasAnyScope(apiKey, [ApiKeyScope.WRITE_RECORDS, ApiKeyScope.READ_PATIENTS])).toBe(false);
    });
  });
});