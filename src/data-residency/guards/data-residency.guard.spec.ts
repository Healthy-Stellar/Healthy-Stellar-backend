import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DataResidencyGuard } from '../guards/data-residency.guard';
import { DataResidencyService } from '../services/data-residency.service';
import { TenantService } from '../../tenant/tenant.service';
import { DataResidencyRegion } from '../../enums/data-residency.enum';

describe('DataResidencyGuard', () => {
  let guard: DataResidencyGuard;
  let dataResidencyService: DataResidencyService;
  let tenantService: TenantService;

  const mockTenant = {
    id: 'tenant-123',
    region: DataResidencyRegion.EU,
    strictDataResidency: true,
    allowedIpRanges: ['10.0.0.0/8', '192.168.1.0/24'],
  };

  const mockExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        user: { tenantId: 'tenant-123' },
        headers: {
          'x-forwarded-for': '10.10.10.10',
        },
        socket: { remoteAddress: '127.0.0.1' },
      }),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataResidencyGuard,
        {
          provide: DataResidencyService,
          useValue: {
            isIpAllowedForRegion: jest.fn(),
          },
        },
        {
          provide: TenantService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<DataResidencyGuard>(DataResidencyGuard);
    dataResidencyService = module.get<DataResidencyService>(
      DataResidencyService,
    );
    tenantService = module.get<TenantService>(TenantService);
  });

  describe('canActivate', () => {
    it('should allow request when no tenant context', async () => {
      const contextWithoutUser = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: undefined,
            headers: {},
            socket: { remoteAddress: '127.0.0.1' },
          }),
        }),
      } as any;

      const result = await guard.canActivate(
        contextWithoutUser as ExecutionContext,
      );
      expect(result).toBe(true);
    });

    it('should throw when tenant not found', async () => {
      jest.spyOn(tenantService, 'findById').mockResolvedValue(null);

      const context = mockExecutionContext as any;
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow request when strict residency disabled', async () => {
      const tenantWithoutStrictMode = {
        ...mockTenant,
        strictDataResidency: false,
      };

      jest
        .spyOn(tenantService, 'findById')
        .mockResolvedValue(tenantWithoutStrictMode);

      const context = mockExecutionContext as any;
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should block request when IP not in allowed ranges', async () => {
      jest.spyOn(tenantService, 'findById').mockResolvedValue(mockTenant);
      jest
        .spyOn(dataResidencyService, 'isIpAllowedForRegion')
        .mockReturnValue(false);

      const context = mockExecutionContext as any;
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow request when IP is in allowed ranges', async () => {
      jest.spyOn(tenantService, 'findById').mockResolvedValue(mockTenant);
      jest
        .spyOn(dataResidencyService, 'isIpAllowedForRegion')
        .mockReturnValue(true);

      const context = mockExecutionContext as any;
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw when region hint does not match tenant region', async () => {
      jest.spyOn(tenantService, 'findById').mockResolvedValue(mockTenant);
      jest
        .spyOn(dataResidencyService, 'isIpAllowedForRegion')
        .mockReturnValue(true);

      const contextWithMismatchedRegion = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { tenantId: 'tenant-123' },
            headers: {
              'x-forwarded-for': '10.10.10.10',
              'x-region-hint': 'US',
            },
            socket: { remoteAddress: '127.0.0.1' },
          }),
        }),
      } as any;

      await expect(guard.canActivate(contextWithMismatchedRegion)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should attach region to request', async () => {
      jest.spyOn(tenantService, 'findById').mockResolvedValue(mockTenant);
      jest
        .spyOn(dataResidencyService, 'isIpAllowedForRegion')
        .mockReturnValue(true);

      const mockRequest = {
        user: { tenantId: 'tenant-123' },
        headers: { 'x-forwarded-for': '10.10.10.10' },
        socket: { remoteAddress: '127.0.0.1' },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as any;

      await guard.canActivate(context);
      expect((mockRequest as any).dataRegion).toBe(DataResidencyRegion.EU);
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      const contextWithForwarded = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as any;

      // Access private method via any casting for testing
      const method = (guard as any).getClientIp;
      const ip = method.call(guard, request);
      expect(ip).toBe('192.168.1.1');
    });

    it('should extract IP from x-client-ip header', () => {
      const request = {
        headers: { 'x-client-ip': '192.168.1.2' },
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      const method = (guard as any).getClientIp;
      const ip = method.call(guard, request);
      expect(ip).toBe('192.168.1.2');
    });

    it('should fallback to socket remote address', () => {
      const request = {
        headers: {},
        socket: { remoteAddress: '127.0.0.2' },
      } as any;

      const method = (guard as any).getClientIp;
      const ip = method.call(guard, request);
      expect(ip).toBe('127.0.0.2');
    });
  });
});
