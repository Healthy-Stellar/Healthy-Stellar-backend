import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantDatabaseRoutingService } from './tenant-database-routing.service';
import { DataResidencyService } from '../data-residency/services/data-residency.service';
import { TenantContext } from '../tenant/context/tenant.context';
import { DataResidencyRegion } from '../enums/data-residency.enum';

describe('TenantDatabaseRoutingService', () => {
  let service: TenantDatabaseRoutingService;
  let dataResidencyService: { getRegionalConfig: jest.Mock; getDefaultRegion: jest.Mock };
  let defaultDataSource: DataSource;

  beforeEach(async () => {
    dataResidencyService = {
      getRegionalConfig: jest.fn().mockReturnValue({
        databaseConfig: {
          type: 'sqlite',
          database: ':memory:',
        },
      }),
      getDefaultRegion: jest.fn().mockReturnValue(DataResidencyRegion.EU),
    };

    defaultDataSource = { options: { type: 'sqlite' }, query: jest.fn(), transaction: jest.fn(), createQueryRunner: jest.fn(), getRepository: jest.fn(), manager: {} } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantDatabaseRoutingService,
        { provide: DataResidencyService, useValue: dataResidencyService },
        { provide: DataSource, useValue: defaultDataSource },
      ],
    }).compile();

    service = module.get(TenantDatabaseRoutingService);
  });

  afterEach(() => {
    TenantContext.clear();
  });

  it('returns the default datasource when no tenant context is present', async () => {
    await service.initialize();
    expect(service.resolveDataSourceForTenant()).toBe(defaultDataSource);
  });

  it('throws a forbidden error when strict residency is violated', async () => {
    await service.initialize();
    TenantContext.run({ tenantId: '1', tenantSlug: 'eu', schemaName: 'tenant_eu', region: DataResidencyRegion.EU, strictDataResidency: true }, () => {
      expect(() => service.resolveDataSourceForTenant(DataResidencyRegion.US)).toThrow(ForbiddenException);
    });
  });
});
