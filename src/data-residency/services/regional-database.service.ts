import { Injectable, Logger } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DataResidencyRegion } from '../../enums/data-residency.enum';
import { DataResidencyService } from './data-residency.service';

/**
 * Manages regional database connections
 * Routes tenant queries to the correct PostgreSQL cluster based on region
 */
@Injectable()
export class RegionalDatabaseService {
  private readonly logger = new Logger(RegionalDatabaseService.name);
  private dataSources: Map<DataResidencyRegion, DataSource> = new Map();

  constructor(private dataResidencyService: DataResidencyService) {}

  /**
   * Initialize data sources for all regions
   */
  async initializeRegionalDataSources(
    baseOptions: Omit<
      DataSourceOptions,
      'host' | 'port' | 'database' | 'name'
    >,
  ): Promise<void> {
    const configs = this.dataResidencyService.getAllRegionalConfigs();

    for (const [region, config] of Object.entries(configs)) {
      try {
        const dataSourceOptions: DataSourceOptions = {
          ...baseOptions,
          name: `datasource-${region}`,
          host: config.databaseConfig.host,
          port: config.databaseConfig.port,
          database: config.databaseConfig.database,
        } as DataSourceOptions;

        const dataSource = new DataSource(dataSourceOptions);
        await dataSource.initialize();

        this.dataSources.set(region as DataResidencyRegion, dataSource);
        this.logger.log(`Data source initialized for region: ${region}`);
      } catch (error) {
        this.logger.error(
          `Failed to initialize data source for region ${region}: ${error.message}`,
        );
        throw error;
      }
    }
  }

  /**
   * Get data source for a specific region
   */
  getDataSource(region: DataResidencyRegion): DataSource {
    const dataSource = this.dataSources.get(region);
    if (!dataSource) {
      throw new Error(`No data source configured for region: ${region}`);
    }
    return dataSource;
  }

  /**
   * Get repository from region-specific data source
   */
  getRepository(region: DataResidencyRegion, entityType: any) {
    return this.getDataSource(region).getRepository(entityType);
  }

  /**
   * Close all regional data sources
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.dataSources.values()).map((ds) =>
      ds.isInitialized ? ds.destroy() : Promise.resolve(),
    );

    await Promise.all(closePromises);
    this.dataSources.clear();
    this.logger.log('All regional data sources closed');
  }

  /**
   * Get connection health status for all regions
   */
  async getRegionalHealthStatus(): Promise<
    Record<DataResidencyRegion, { status: string; latency: number }>
  > {
    const healthStatus: Record<
      DataResidencyRegion,
      { status: string; latency: number }
    > = {} as any;

    for (const [region, dataSource] of this.dataSources.entries()) {
      try {
        const startTime = Date.now();
        await dataSource.query('SELECT 1');
        const latency = Date.now() - startTime;

        healthStatus[region as DataResidencyRegion] = {
          status: 'healthy',
          latency,
        };
      } catch (error) {
        healthStatus[region as DataResidencyRegion] = {
          status: 'unhealthy',
          latency: -1,
        };
      }
    }

    return healthStatus;
  }
}
