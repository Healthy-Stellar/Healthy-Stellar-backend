import { ForbiddenException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import { DataResidencyRegion } from '../enums/data-residency.enum';
import { TenantContext } from '../tenant/context/tenant.context';
import { DataResidencyService } from '../data-residency/services/data-residency.service';

@Injectable()
export class TenantDatabaseRoutingService implements OnModuleInit {
  private readonly logger = new Logger(TenantDatabaseRoutingService.name);
  private readonly regionalDataSources = new Map<DataResidencyRegion, DataSource>();

  constructor(
    @InjectDataSource() private readonly defaultDataSource: DataSource,
    private readonly dataResidencyService: DataResidencyService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    const regions = [
      DataResidencyRegion.EU,
      DataResidencyRegion.US,
      DataResidencyRegion.APAC,
      DataResidencyRegion.AFRICA,
    ];

    for (const region of regions) {
      try {
        const config = this.dataResidencyService.getRegionalConfig(region);
        const options = this.buildDataSourceOptions(region, config);

        if (!options) {
          continue;
        }

        const dataSource = new DataSource(options);
        await dataSource.initialize();
        this.regionalDataSources.set(region, dataSource);
      } catch (error) {
        this.logger.warn(
          `Regional datasource for ${region} is unavailable: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  createProxyDataSource(): DataSource {
    return new Proxy(this.defaultDataSource, {
      get: (target, property, receiver) => {
        if (property === 'query') {
          return (...args: unknown[]) => {
            const dataSource = this.resolveDataSourceForTenant();
            return dataSource.query(...args);
          };
        }

        if (property === 'transaction') {
          return (...args: unknown[]) => {
            const dataSource = this.resolveDataSourceForTenant();
            return dataSource.transaction(...args);
          };
        }

        if (property === 'createQueryRunner') {
          return () => this.resolveDataSourceForTenant().createQueryRunner();
        }

        if (property === 'getRepository') {
          return (entity: unknown) => this.resolveDataSourceForTenant().getRepository(entity as any);
        }

        if (property === 'manager') {
          return this.createManagerProxy(this.resolveDataSourceForTenant());
        }

        return Reflect.get(target, property, receiver);
      },
    }) as unknown as DataSource;
  }

  resolveDataSourceForTenant(region?: DataResidencyRegion): DataSource {
    const tenantContext = TenantContext.get();
    const tenantRegion = tenantContext?.region;
    const resolvedRegion = region ?? tenantRegion ?? this.dataResidencyService.getDefaultRegion();

    if (tenantContext?.strictDataResidency && tenantRegion && region && tenantRegion !== region) {
      throw new ForbiddenException(
        'Tenant data residency policy prohibits access outside the configured region.',
      );
    }

    if (tenantContext?.strictDataResidency && !this.hasRegionalConnection(resolvedRegion)) {
      throw new ForbiddenException(
        'Tenant data residency policy prohibits access outside the configured region.',
      );
    }

    const dataSource = this.regionalDataSources.get(resolvedRegion);
    return dataSource ?? this.defaultDataSource;
  }

  private createManagerProxy(dataSource: DataSource): unknown {
    return new Proxy(dataSource.manager, {
      get: (target, property, receiver) => {
        if (property === 'query') {
          return (...args: unknown[]) => dataSource.query(...args);
        }

        return Reflect.get(target, property, receiver);
      },
    });
  }

  private hasRegionalConnection(region: DataResidencyRegion): boolean {
    const configured = this.regionalDataSources.get(region);
    return Boolean(configured);
  }

  private buildDataSourceOptions(
    region: DataResidencyRegion,
    config: ReturnType<DataResidencyService['getRegionalConfig']>,
  ): DataSourceOptions | null {
    const dbType = config.databaseConfig.type || 'postgres';

    if (dbType === 'sqlite') {
      const database = config.databaseConfig.database || config.databaseConfig.url;
      if (!database) {
        return null;
      }

      return {
        type: 'sqlite',
        name: `tenant-residency-${region}`,
        database,
        entities: [path.join(__dirname, '..', '**', '*.entity{.ts,.js}')],
        synchronize: false,
        logging: false,
      };
    }

    const url = config.databaseConfig.url;
    if (!url && !config.databaseConfig.host) {
      return null;
    }

    return {
      type: 'postgres',
      name: `tenant-residency-${region}`,
      url,
      host: config.databaseConfig.host || process.env.DB_HOST,
      port: config.databaseConfig.port || Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: config.databaseConfig.database || process.env.DB_NAME,
      entities: [path.join(__dirname, '..', '**', '*.entity{.ts,.js}')],
      synchronize: false,
      logging: false,
    };
  }
}
