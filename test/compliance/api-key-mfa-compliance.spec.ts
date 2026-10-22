import 'reflect-metadata';
import { MfaVerifiedGuard } from '../../src/auth/guards/mfa-verified.guard';
import { ApiKeyGuard } from '../../src/auth/guards/api-key.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { ApiKeyScope } from '../../src/auth/entities/api-key.entity';
import { UserRole } from '../../src/auth/entities/user.entity';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('API Key / MFA Compliance', () => {
  describe('MfaVerifiedGuard — structurally rejects API key auth', () => {
    // Instantiate the guard directly with a mock to avoid DI complications with compiled JS
    const mockMfaService = { isMfaEnabled: jest.fn() };
    const guard = new (MfaVerifiedGuard as any)(mockMfaService);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('throws when request.user is missing', async () => {
      const ctx = { switchToHttp: () => ({ getRequest: () => ({}) }) };
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('throws when user has API key shape (no userId) and MFA is enabled', async () => {
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { type: 'api_key', apiKey: { id: 'key-1', scopes: [ApiKeyScope.READ_RECORDS] } },
          }),
        }),
      };
      mockMfaService.isMfaEnabled.mockResolvedValue(true);
      await expect(guard.canActivate(ctx)).rejects.toThrow('MFA verification required');
    });

    it('throws when user.mfaEnabled is false but MFA is enabled in DB', async () => {
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              userId: 'user-1', email: 'test@example.com', role: UserRole.PHYSICIAN,
              mfaEnabled: false, sessionId: 'sess-1', organizationId: 'org-1',
            },
          }),
        }),
      };
      mockMfaService.isMfaEnabled.mockResolvedValue(true);
      await expect(guard.canActivate(ctx)).rejects.toThrow('MFA verification required');
    });

    it('passes when user.mfaEnabled is true (MFA already verified in JWT)', async () => {
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              userId: 'user-1', email: 'test@example.com', role: UserRole.PHYSICIAN,
              mfaEnabled: true, sessionId: 'sess-1', organizationId: 'org-1',
            },
          }),
        }),
      };
      mockMfaService.isMfaEnabled.mockResolvedValue(true);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('passes when user has MFA disabled in DB', async () => {
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              userId: 'user-2', email: 'test@example.com', role: UserRole.PATIENT,
              mfaEnabled: false, sessionId: 'sess-2', organizationId: 'org-1',
            },
          }),
        }),
      };
      mockMfaService.isMfaEnabled.mockResolvedValue(false);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('ApiKeyGuard — intentionally bypasses MFA', () => {
    const mockApiKeyService = {
      validateApiKey: jest.fn(),
      hasAnyScope: jest.fn(),
      apiKeyRepository: { update: jest.fn() },
    };
    const mockReflector = { getAllAndOverride: jest.fn() };
    const guard = new (ApiKeyGuard as any)(mockApiKeyService, mockReflector);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('authenticates with API key and sets request.user WITHOUT MFA check', async () => {
      const validatedKey = {
        id: 'key-123', name: 'Test Key',
        scopes: [ApiKeyScope.READ_RECORDS], isActive: true,
      };
      const mockRequest = { headers: { 'x-api-key': 'valid-key' }, ip: '10.0.0.1' };

      mockReflector.getAllAndOverride.mockReturnValueOnce(false);
      mockReflector.getAllAndOverride.mockReturnValueOnce(null);
      mockApiKeyService.validateApiKey.mockResolvedValue(validatedKey);

      const ctx = {
        getHandler: jest.fn(), getClass: jest.fn(),
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      };

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({ type: 'api_key', apiKey: validatedKey });
      expect(mockRequest.user).not.toHaveProperty('mfaEnabled');
      expect(mockRequest.user).not.toHaveProperty('sessionId');
      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('valid-key');
      expect(mockApiKeyService.hasAnyScope).not.toHaveBeenCalled();
    });
  });

  describe('RolesGuard — incompatible with API key auth (expects JwtPayload)', () => {
    const guard = new (RolesGuard as any)();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('throws ForbiddenException when user is an API key (no role property)', () => {
      const handler = () => {};
      Reflect.defineMetadata('roles', ['physician'], handler);

      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { type: 'api_key', apiKey: { id: 'key-1' } },
          }),
        }),
        getHandler: () => handler,
        getClass: jest.fn(),
      };

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user is missing entirely', () => {
      const handler = () => {};
      Reflect.defineMetadata('roles', ['physician'], handler);

      const ctx = {
        switchToHttp: () => ({ getRequest: () => ({}) }),
        getHandler: () => handler,
        getClass: jest.fn(),
      };

      expect(() => guard.canActivate(ctx)).toThrow('User not found in request');
    });

    it('passes correctly with JwtPayload user having the required role', () => {
      const handler = () => {};
      Reflect.defineMetadata('roles', ['physician'], handler);

      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              userId: 'user-1', email: 'doctor@example.com', role: UserRole.PHYSICIAN,
              mfaEnabled: true, sessionId: 'sess-1', organizationId: 'org-1',
            },
          }),
        }),
        getHandler: () => handler,
        getClass: jest.fn(),
      };

      const result = guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });
});
