import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantIpAllowlistGuard } from './tenant-ip-allowlist.guard';
import { TenantConfigService } from '../services/tenant-config.service';
import { SUPPORTED_CONFIG_KEYS } from '../constants/config-keys.constant';

describe('TenantIpAllowlistGuard', () => {
  let guard: TenantIpAllowlistGuard;
  let tenantConfigService: TenantConfigService;

  const ownTenantId = '11111111-1111-1111-1111-111111111111';
  const attackerChosenTenantId = '22222222-2222-2222-2222-222222222222';

  const mockTenantConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantIpAllowlistGuard,
        {
          provide: TenantConfigService,
          useValue: mockTenantConfigService,
        },
      ],
    }).compile();

    guard = module.get<TenantIpAllowlistGuard>(TenantIpAllowlistGuard);
    tenantConfigService = module.get<TenantConfigService>(TenantConfigService);

    jest.clearAllMocks();
  });

  const createMockExecutionContext = (request: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  describe('tenant resolution', () => {
    it('resolves the tenant from the authenticated user, ignoring a spoofed params.tenantId', async () => {
      mockTenantConfigService.get.mockResolvedValue(['203.0.113.5']);

      const request = {
        params: { tenantId: attackerChosenTenantId },
        query: {},
        headers: { 'x-forwarded-for': '10.0.0.1' },
        user: { tenantId: ownTenantId },
      };

      await expect(guard.canActivate(createMockExecutionContext(request))).rejects.toThrow(
        ForbiddenException,
      );

      expect(tenantConfigService.get).toHaveBeenCalledWith(
        ownTenantId,
        SUPPORTED_CONFIG_KEYS.IP_ALLOWLIST,
      );
      expect(tenantConfigService.get).not.toHaveBeenCalledWith(
        attackerChosenTenantId,
        expect.anything(),
      );
    });

    it('resolves the tenant from the authenticated user, ignoring a spoofed query.tenantId', async () => {
      mockTenantConfigService.get.mockResolvedValue(['203.0.113.5']);

      const request = {
        params: {},
        query: { tenantId: attackerChosenTenantId },
        headers: { 'x-forwarded-for': '10.0.0.1' },
        user: { tenantId: ownTenantId },
      };

      await expect(guard.canActivate(createMockExecutionContext(request))).rejects.toThrow(
        ForbiddenException,
      );

      expect(tenantConfigService.get).toHaveBeenCalledWith(
        ownTenantId,
        SUPPORTED_CONFIG_KEYS.IP_ALLOWLIST,
      );
    });

    it('resolves the tenant from the authenticated user, ignoring a spoofed x-tenant-id header', async () => {
      mockTenantConfigService.get.mockResolvedValue(['203.0.113.5']);

      const request = {
        params: {},
        query: {},
        headers: {
          'x-forwarded-for': '10.0.0.1',
          'x-tenant-id': attackerChosenTenantId,
        },
        user: { tenantId: ownTenantId },
      };

      await expect(guard.canActivate(createMockExecutionContext(request))).rejects.toThrow(
        ForbiddenException,
      );

      expect(tenantConfigService.get).toHaveBeenCalledWith(
        ownTenantId,
        SUPPORTED_CONFIG_KEYS.IP_ALLOWLIST,
      );
    });

    it('cannot be redirected to an unprotected tenant via a spoofed tenantId, even though the caller has no allowlist of their own', async () => {
      // The attacker's own tenant has an allowlist configured (would block them),
      // but they try to pass a different tenantId that has no allowlist at all,
      // hoping the guard checks that tenant instead and skips enforcement.
      mockTenantConfigService.get.mockImplementation(async (tenantId: string) => {
        if (tenantId === ownTenantId) {
          return ['203.0.113.5']; // caller's real tenant enforces an allowlist
        }
        return null; // attacker-chosen tenant has no allowlist configured
      });

      const request = {
        params: { tenantId: attackerChosenTenantId },
        query: { tenantId: attackerChosenTenantId },
        headers: {
          'x-forwarded-for': '10.0.0.1',
          'x-tenant-id': attackerChosenTenantId,
        },
        user: { tenantId: ownTenantId },
      };

      // Must be denied: the guard should enforce the caller's own tenant's
      // allowlist, not fall through to an unprotected spoofed tenant.
      await expect(guard.canActivate(createMockExecutionContext(request))).rejects.toThrow(
        ForbiddenException,
      );
      expect(tenantConfigService.get).toHaveBeenCalledWith(
        ownTenantId,
        SUPPORTED_CONFIG_KEYS.IP_ALLOWLIST,
      );
    });

    it('falls back to user.organizationId when user.tenantId is not present', async () => {
      mockTenantConfigService.get.mockResolvedValue(null);

      const request = {
        params: {},
        query: {},
        headers: {},
        user: { organizationId: ownTenantId },
      };

      const result = await guard.canActivate(createMockExecutionContext(request));

      expect(result).toBe(true);
      expect(tenantConfigService.get).toHaveBeenCalledWith(
        ownTenantId,
        SUPPORTED_CONFIG_KEYS.IP_ALLOWLIST,
      );
    });

    it('allows the request when there is no authenticated user and no tenant can be resolved', async () => {
      const request = {
        params: { tenantId: attackerChosenTenantId },
        query: {},
        headers: {},
        user: undefined,
      };

      const result = await guard.canActivate(createMockExecutionContext(request));

      expect(result).toBe(true);
      expect(tenantConfigService.get).not.toHaveBeenCalled();
    });
  });

  describe("allowlist enforcement for the caller's own tenant", () => {
    it('allows the request when no allowlist is configured', async () => {
      mockTenantConfigService.get.mockResolvedValue(null);

      const request = {
        params: {},
        query: {},
        headers: { 'x-forwarded-for': '10.0.0.1' },
        user: { tenantId: ownTenantId },
      };

      const result = await guard.canActivate(createMockExecutionContext(request));

      expect(result).toBe(true);
    });

    it('allows the request when the client IP matches an allowlist entry', async () => {
      mockTenantConfigService.get.mockResolvedValue(['10.0.0.0/8']);

      const request = {
        params: {},
        query: {},
        headers: { 'x-forwarded-for': '10.0.0.50' },
        user: { tenantId: ownTenantId },
      };

      const result = await guard.canActivate(createMockExecutionContext(request));

      expect(result).toBe(true);
    });

    it('denies the request when the client IP does not match any allowlist entry', async () => {
      mockTenantConfigService.get.mockResolvedValue(['10.0.0.0/8']);

      const request = {
        params: {},
        query: {},
        headers: { 'x-forwarded-for': '1.2.3.4' },
        user: { tenantId: ownTenantId },
      };

      await expect(guard.canActivate(createMockExecutionContext(request))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
