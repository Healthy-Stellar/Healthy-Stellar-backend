import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagGuard } from './feature-flag.guard';
import { TenantConfigService } from '../services/tenant-config.service';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature.decorator';

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard;
  let tenantConfigService: TenantConfigService;
  let reflector: Reflector;

  const mockTenantConfigService = {
    isFeatureEnabled: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagGuard,
        {
          provide: TenantConfigService,
          useValue: mockTenantConfigService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<FeatureFlagGuard>(FeatureFlagGuard);
    tenantConfigService = module.get<TenantConfigService>(TenantConfigService);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  const createMockExecutionContext = (request: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
    } as any;
  };

  describe('canActivate', () => {
    it('should allow access when no feature requirement is set', async () => {
      mockReflector.get.mockReturnValue(undefined);

      const context = createMockExecutionContext({});
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(tenantConfigService.isFeatureEnabled).not.toHaveBeenCalled();
    });

    it('should allow access when feature is enabled', async () => {
      const tenantId = '11111111-1111-1111-1111-111111111111';
      const featureKey = 'fhir_export_enabled';

      mockReflector.get.mockReturnValue(featureKey);
      mockTenantConfigService.isFeatureEnabled.mockResolvedValue(true);

      const context = createMockExecutionContext({
        params: { id: tenantId },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(tenantConfigService.isFeatureEnabled).toHaveBeenCalledWith(
        tenantId,
        featureKey,
      );
    });

    it('should deny access when feature is disabled', async () => {
      const tenantId = '11111111-1111-1111-1111-111111111111';
      const featureKey = 'fhir_export_enabled';

      mockReflector.get.mockReturnValue(featureKey);
      mockTenantConfigService.isFeatureEnabled.mockResolvedValue(false);

      const context = createMockExecutionContext({
        params: { id: tenantId },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        `Feature "${featureKey}" is not enabled for your organization`,
      );
    });

    it('should extract tenant ID from URL params (id)', async () => {
      const tenantId = '11111111-1111-1111-1111-111111111111';
      const featureKey = 'fhir_export_enabled';

      mockReflector.get.mockReturnValue(featureKey);
      mockTenantConfigService.isFeatureEnabled.mockResolvedValue(true);

      const context = createMockExecutionContext({
        params: { id: tenantId },
      });

      await guard.canActivate(context);

      expect(tenantConfigService.isFeatureEnabled).toHaveBeenCalledWith(
        tenantId,
        featureKey,
      );
    });

    it('should extract tenant ID from URL params (tenantId)', async () => {
      const tenantId = '22222222-2222-2222-2222-222222222222';
      const featureKey = 'fhir_export_enabled';

      mockReflector.get.mockReturnValue(featureKey);
      mockTenantConfigService.isFeatureEnabled.mockResolvedValue(true);

      const context = createMockExecutionContext({
        params: { tenantId },
      });

      await guard.canActivate(context);

      expect(tenantConfigService.isFeatureEnabled).toHaveBeenCalledWith(
        tenantId,
        featureKey,
      );
    });

    it('should extract tenant ID from query params', async () => {
      const tenantId = '33333333-3333-3333-3333-333333333333';
      const featureKey = 'fhir_export_enabled';

      mockReflector.get.mockReturnValue(featureKey);
      mockTenantConfigService.isFeatureEnabled.mockResolvedValue(true);

      const context = createMockExecutionContext({
        params: {},
        query: { tenantId },
      });

      await guard.canActivate(context);

      expect(tenantConfigService.isFeatureEnabled).toHaveBeenCalledWith(
        tenantId,
        featureKey,
      );
    });

    it('should extract tenant ID from custom header', async () => {
      const tenantId = '44444444-4444-4444-4444-444444444444';
      const featureKey = 'fhir_export_enabled';

      mockReflector.get.mockReturnValue(featureKey);
      mockTenantConfigService.isFeatureEnabled.mockResolvedValue(true);

      const context = createMockExecutionContext({
        params: {},
        query: {},
        headers: { 'x-tenant-id': tenantId },
      });

      await guard.canActivate(context);

      expect(tenantConfigService.isFeatureEnabled).toHaveBeenCalledWith(
        tenantId,
        featureKey,
      );
    });

    it('should extract tenant ID from user object (tenantId)', async () => {
      const tenantId = '55555555-5555-5555-5555-555555555555';
      const featureKey = 'fhir_export_enabled';

      mockReflector.get.mockReturnValue(featureKey);
      mockTenantConfigService.isFeatureEnabled.mockResolvedValue(true);

      const context = createMockExecutionContext({
        params: {},
        query: {},
        headers: {},
        user: { tenantId },
      });

      await guard.canActivate(context);

      expect(tenantConfigService.isFeatureEnabled).toHaveBeenCalledWith(
        tenantId,
        featureKey,
      );
    });

    it('should extract tenant ID from user object (organizationId)', async () => {
      const tenantId = '66666666-6666-6666-6666-666666666666';
      const featureKey = 'fhir_export_enabled';

      mockReflector.get.mockReturnValue(featureKey);
      mockTenantConfigService.isFeatureEnabled.mockResolvedValue(true);

      const context = createMockExecutionContext({
        params: {},
        query: {},
        headers: {},
        user: { organizationId: tenantId },
      });

      await guard.canActivate(context);

      expect(tenantConfigService.isFeatureEnabled).toHaveBeenCalledWith(
        tenantId,
        featureKey,
      );
    });

    it('should throw ForbiddenException when tenant ID cannot be extracted', async () => {
      const featureKey = 'fhir_export_enabled';

      mockReflector.get.mockReturnValue(featureKey);

      const context = createMockExecutionContext({
        params: {},
        query: {},
        headers: {},
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Tenant identification required',
      );
    });

    it('should prioritize URL params over other sources', async () => {
      const urlTenantId = '77777777-7777-7777-7777-777777777777';
      const headerTenantId = '88888888-8888-8888-8888-888888888888';
      const featureKey = 'fhir_export_enabled';

      mockReflector.get.mockReturnValue(featureKey);
      mockTenantConfigService.isFeatureEnabled.mockResolvedValue(true);

      const context = createMockExecutionContext({
        params: { id: urlTenantId },
        headers: { 'x-tenant-id': headerTenantId },
      });

      await guard.canActivate(context);

      expect(tenantConfigService.isFeatureEnabled).toHaveBeenCalledWith(
        urlTenantId,
        featureKey,
      );
    });
  });
});
