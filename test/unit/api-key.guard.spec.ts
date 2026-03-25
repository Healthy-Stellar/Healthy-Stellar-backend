import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from '../../../src/auth/guards/api-key.guard';
import { ApiKeyService } from '../../../src/auth/services/api-key.service';
import { ApiKey, ApiKeyScope } from '../../../src/auth/entities/api-key.entity';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let apiKeyService: ApiKeyService;
  let reflector: Reflector;

  const mockApiKeyService = {
    validateApiKey: jest.fn(),
    hasAnyScope: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        {
          provide: ApiKeyService,
          useValue: mockApiKeyService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
    apiKeyService = module.get<ApiKeyService>(ApiKeyService);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    const mockExecutionContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
    };

    it('should allow access for public routes', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true); // IS_PUBLIC_KEY

      const result = await guard.canActivate(mockExecutionContext as any);

      expect(result).toBe(true);
    });

    it('should validate API key and allow access', async () => {
      const apiKey = 'valid-api-key';
      const mockValidatedKey = {
        id: 'key-123',
        scopes: [ApiKeyScope.READ_RECORDS],
      } as ApiKey;

      const mockRequest = {
        headers: { 'x-api-key': apiKey },
        ip: '127.0.0.1',
      };

      mockReflector.getAllAndOverride.mockReturnValueOnce(false); // Not public
      mockReflector.getAllAndOverride.mockReturnValueOnce(null); // No required scopes
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(mockRequest);
      mockApiKeyService.validateApiKey.mockResolvedValue(mockValidatedKey);

      const result = await guard.canActivate(mockExecutionContext as any);

      expect(result).toBe(true);
      expect(mockRequest.apiKey).toEqual(mockValidatedKey);
      expect(mockRequest.user).toEqual({ type: 'api_key', apiKey: mockValidatedKey });
    });

    it('should deny access for missing API key', async () => {
      const mockRequest = {
        headers: {},
      };

      mockReflector.getAllAndOverride.mockReturnValueOnce(false); // Not public
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(mockRequest);

      await expect(guard.canActivate(mockExecutionContext as any)).rejects.toThrow(
        'No API key provided',
      );
    });

    it('should deny access for invalid API key', async () => {
      const mockRequest = {
        headers: { 'x-api-key': 'invalid-key' },
      };

      mockReflector.getAllAndOverride.mockReturnValueOnce(false); // Not public
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(mockRequest);
      mockApiKeyService.validateApiKey.mockResolvedValue(null);

      await expect(guard.canActivate(mockExecutionContext as any)).rejects.toThrow(
        'Invalid or inactive API key',
      );
    });

    it('should deny access when API key lacks required scope', async () => {
      const apiKey = 'limited-api-key';
      const mockValidatedKey = {
        id: 'key-123',
        scopes: [ApiKeyScope.READ_RECORDS],
      } as ApiKey;

      const mockRequest = {
        headers: { 'x-api-key': apiKey },
      };

      mockReflector.getAllAndOverride.mockReturnValueOnce(false); // Not public
      mockReflector.getAllAndOverride.mockReturnValueOnce([ApiKeyScope.WRITE_RECORDS]); // Required scopes
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(mockRequest);
      mockApiKeyService.validateApiKey.mockResolvedValue(mockValidatedKey);
      mockApiKeyService.hasAnyScope.mockReturnValue(false);

      await expect(guard.canActivate(mockExecutionContext as any)).rejects.toThrow(
        'API key does not have required scope',
      );
    });

    it('should allow access when API key has required scope', async () => {
      const apiKey = 'scoped-api-key';
      const mockValidatedKey = {
        id: 'key-123',
        scopes: [ApiKeyScope.READ_RECORDS, ApiKeyScope.WRITE_RECORDS],
      } as ApiKey;

      const mockRequest = {
        headers: { 'x-api-key': apiKey },
      };

      mockReflector.getAllAndOverride.mockReturnValueOnce(false); // Not public
      mockReflector.getAllAndOverride.mockReturnValueOnce([ApiKeyScope.WRITE_RECORDS]); // Required scopes
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(mockRequest);
      mockApiKeyService.validateApiKey.mockResolvedValue(mockValidatedKey);
      mockApiKeyService.hasAnyScope.mockReturnValue(true);

      const result = await guard.canActivate(mockExecutionContext as any);

      expect(result).toBe(true);
    });
  });
});