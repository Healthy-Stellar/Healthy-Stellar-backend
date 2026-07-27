import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyStrategy } from '../../../src/auth/strategies/api-key.strategy';
import { ApiKeyService } from '../../../src/auth/services/api-key.service';
import { ApiKey } from '../../../src/auth/entities/api-key.entity';

describe('ApiKeyStrategy', () => {
  let strategy: ApiKeyStrategy;
  let apiKeyService: ApiKeyService;

  const mockApiKeyService = {
    validateApiKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyStrategy,
        {
          provide: ApiKeyService,
          useValue: mockApiKeyService,
        },
      ],
    }).compile();

    strategy = module.get<ApiKeyStrategy>(ApiKeyStrategy);
    apiKeyService = module.get<ApiKeyService>(ApiKeyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should validate API key from X-API-Key header', async () => {
      const apiKey = 'test-api-key-123';
      const mockValidatedKey = {
        id: 'key-123',
        name: 'Test Key',
        scopes: ['read:records'],
      } as ApiKey;

      const mockRequest = {
        headers: {
          'x-api-key': apiKey,
        },
        ip: '127.0.0.1',
      };

      mockApiKeyService.validateApiKey.mockResolvedValue(mockValidatedKey);

      const result = await (strategy as any).validate(mockRequest);

      expect(result).toEqual({
        apiKey: mockValidatedKey,
        type: 'api_key',
      });
      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith(apiKey);
    });

    it('should handle array X-API-Key header', async () => {
      const apiKey = 'test-api-key-123';
      const mockValidatedKey = {
        id: 'key-123',
        name: 'Test Key',
      } as ApiKey;

      const mockRequest = {
        headers: {
          'x-api-key': [apiKey],
        },
        ip: '127.0.0.1',
      };

      mockApiKeyService.validateApiKey.mockResolvedValue(mockValidatedKey);

      const result = await (strategy as any).validate(mockRequest);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith(apiKey);
    });

    it('should throw UnauthorizedException for missing API key', async () => {
      const mockRequest = {
        headers: {},
      };

      await expect((strategy as any).validate(mockRequest)).rejects.toThrow(
        'No API key provided',
      );
    });

    it('should throw UnauthorizedException for invalid API key', async () => {
      const mockRequest = {
        headers: {
          'x-api-key': 'invalid-key',
        },
      };

      mockApiKeyService.validateApiKey.mockResolvedValue(null);

      await expect((strategy as any).validate(mockRequest)).rejects.toThrow(
        'Invalid or inactive API key',
      );
    });
  });
});