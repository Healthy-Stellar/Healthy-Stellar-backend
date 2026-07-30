import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ForbiddenException } from '@nestjs/common';
import request from 'supertest';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TenantDatabaseRoutingService } from '../src/database/tenant-database-routing.service';
import { DataResidencyService } from '../src/data-residency/services/data-residency.service';
import { TenantContext } from '../src/tenant/context/tenant.context';
import { DataResidencyRegion } from '../src/enums/data-residency.enum';

class TestController {
  constructor(private readonly routingService: TenantDatabaseRoutingService) {}

  async route() {
    const dataSource = this.routingService.resolveDataSourceForTenant(DataResidencyRegion.EU);
    return dataSource.options.database;
  }
}

describe('tenant residency routing integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TenantDatabaseRoutingService,
        {
          provide: DataResidencyService,
          useValue: {
            getRegionalConfig: jest.fn((region: DataResidencyRegion) => ({
              databaseConfig: {
                type: 'sqlite',
                database: region === DataResidencyRegion.EU ? 'eu.sqlite' : 'us.sqlite',
              },
            })),
            getDefaultRegion: jest.fn(() => DataResidencyRegion.EU),
          },
        },
        {
          provide: DataSource,
          useValue: {
            options: { type: 'sqlite' },
            query: jest.fn(),
            transaction: jest.fn(),
            createQueryRunner: jest.fn(),
            getRepository: jest.fn(),
            manager: {},
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataSource = moduleRef.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
    TenantContext.clear();
  });

  it('routes EU tenants to the EU database', async () => {
    const service = app.get(TenantDatabaseRoutingService);
    TenantContext.run(
      {
        tenantId: 'eu-tenant',
        tenantSlug: 'eu',
        schemaName: 'tenant_eu',
        region: DataResidencyRegion.EU,
        strictDataResidency: true,
      },
      () => {
        const resolved = service.resolveDataSourceForTenant(DataResidencyRegion.EU);
        expect(resolved.options.database).toBe('eu.sqlite');
      },
    );
  });

  it('rejects cross-region access for strict tenants', async () => {
    const service = app.get(TenantDatabaseRoutingService);
    TenantContext.run(
      {
        tenantId: 'eu-tenant',
        tenantSlug: 'eu',
        schemaName: 'tenant_eu',
        region: DataResidencyRegion.EU,
        strictDataResidency: true,
      },
      () => {
        expect(() => service.resolveDataSourceForTenant(DataResidencyRegion.US)).toThrow(ForbiddenException);
      },
    );
  });
});
