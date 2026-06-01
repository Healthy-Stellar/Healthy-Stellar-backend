import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DataResidencyInterceptor } from './data-residency.interceptor';
import { TenantService } from '../../tenant/services/tenant.service';
import { DataResidencyService, RegionalConfig } from '../../data-residency/services/data-residency.service';
import { TenantContext, TenantContextData } from '../../tenant/context/tenant.context';
import { DataResidencyRegion } from '../../enums/data-residency.enum';

describe('DataResidencyInterceptor', () => {
  let interceptor: DataResidencyInterceptor;
  let dataSource: any;
  let tenantService: any;
  let dataResidencyService: any;
  let mockExecutionContext: any;
  let mockCallHandler: any;

  beforeEach(async () => {
    // Mock dataSource
    dataSource = {
      options: {
        host: 'eu-db.example.com',
      },
      query: jest.fn(),
    };

    // Mock tenantService
    tenantService = {
      findById: jest.fn(),
    };

    // Mock dataResidencyService
    dataResidencyService = {
      getRegionalConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataResidencyInterceptor,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: TenantService,
          useValue: tenantService,
        },
        {
          provide: DataResidencyService,
          useValue: dataResidencyService,
        },
      ],
    }).compile();

    interceptor = module.get<DataResidencyInterceptor>(DataResidencyInterceptor);

    // Setup mock execution context
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    };

    mockCallHandler = {
      handle: jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnValue('success'),
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Read operations (allowed regardless of residency)', () => {
    it('should allow GET requests even without residency context', async () => {
      const request = { method: 'GET' };
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);

      await interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should allow HEAD requests', async () => {
      const request = { method: 'HEAD' };
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);

      await interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockCallHandler.handle).toHaveBeenCalled();
    });
  });

  describe('Write operations with data residency enforcement', () => {
    it('should reject POST without tenant context', async () => {
      const request = { method: 'POST' };
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);

      // No tenant context
      jest.spyOn(TenantContext, 'get').mockReturnValue(undefined);

      await expect(interceptor.intercept(mockExecutionContext, mockCallHandler)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject PUT if tenant region does not match connected database', async () => {
      const request = { method: 'PUT' };
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);

      const tenantContext: TenantContextData = {
        tenantId: 'tenant-1',
        tenantSlug: 'tenant-eu',
        schemaName: 'tenant_tenant_eu',
      };

      jest.spyOn(TenantContext, 'get').mockReturnValue(tenantContext);

      // Tenant configured for EU but connected to US
      const tenant = {
        id: 'tenant-1',
        region: DataResidencyRegion.EU,
        strictDataResidency: true,
      };

      tenantService.findById.mockResolvedValue(tenant);

      const euConfig: RegionalConfig = {
        horizonUrl: 'https://horizon.stellar.org',
        ipfsNodes: ['ipfs.eu'],
        databaseConfig: {
          host: 'eu-db.example.com',
          port: 5432,
          database: 'healthy_eu',
        },
        awsRegion: 'eu-west-1',
        dataCenter: 'Frankfurt',
        description: 'EU Data Center',
      };

      dataResidencyService.getRegionalConfig.mockReturnValue(euConfig);

      // Mock that we're connected to US database
      dataSource.options.host = 'us-db.example.com';

      await expect(interceptor.intercept(mockExecutionContext, mockCallHandler)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow PATCH if tenant region matches connected database', async () => {
      const request = { method: 'PATCH' };
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);

      const tenantContext: TenantContextData = {
        tenantId: 'tenant-1',
        tenantSlug: 'tenant-eu',
        schemaName: 'tenant_tenant_eu',
      };

      jest.spyOn(TenantContext, 'get').mockReturnValue(tenantContext);

      const tenant = {
        id: 'tenant-1',
        region: DataResidencyRegion.EU,
        strictDataResidency: true,
      };

      tenantService.findById.mockResolvedValue(tenant);

      const euConfig: RegionalConfig = {
        horizonUrl: 'https://horizon.stellar.org',
        ipfsNodes: ['ipfs.eu'],
        databaseConfig: {
          host: 'eu-db.example.com',
          port: 5432,
          database: 'healthy_eu',
        },
        awsRegion: 'eu-west-1',
        dataCenter: 'Frankfurt',
        description: 'EU Data Center',
      };

      dataResidencyService.getRegionalConfig.mockReturnValue(euConfig);

      // Connected database matches EU region
      dataSource.options.host = 'eu-db.example.com';

      await interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should allow DELETE if strict residency is disabled', async () => {
      const request = { method: 'DELETE' };
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);

      const tenantContext: TenantContextData = {
        tenantId: 'tenant-1',
        tenantSlug: 'tenant-eu',
        schemaName: 'tenant_tenant_eu',
      };

      jest.spyOn(TenantContext, 'get').mockReturnValue(tenantContext);

      const tenant = {
        id: 'tenant-1',
        region: DataResidencyRegion.EU,
        strictDataResidency: false, // Disabled
      };

      tenantService.findById.mockResolvedValue(tenant);

      // Even if database doesn't match, should be allowed if strict mode is off
      dataSource.options.host = 'us-db.example.com';

      await interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should reject DELETE if tenant is not found', async () => {
      const request = { method: 'DELETE' };
      mockExecutionContext.switchToHttp().getRequest.mockReturnValue(request);

      const tenantContext: TenantContextData = {
        tenantId: 'tenant-1',
        tenantSlug: 'tenant-eu',
        schemaName: 'tenant_tenant_eu',
      };

      jest.spyOn(TenantContext, 'get').mockReturnValue(tenantContext);
      tenantService.findById.mockResolvedValue(null);

      await expect(interceptor.intercept(mockExecutionContext, mockCallHandler)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
