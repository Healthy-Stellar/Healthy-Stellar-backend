import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class SyntheticProbeIndicator extends HealthIndicator {
  private readonly logger = new Logger(SyntheticProbeIndicator.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    const results: any = {
      databaseQuery: { status: 'up', responseTime: '0ms' },
    };

    try {
      // Test critical user journey: Database read operation
      await this.dataSource.query('SELECT 1');
      results.databaseQuery.responseTime = `${Date.now() - startTime}ms`;

      return this.getStatus(key, true, results);
    } catch (error) {
      this.logger.error(`Synthetic probe failed: ${error.message}`);
      results.databaseQuery = { status: 'down', error: error.message };
      throw new HealthCheckError(
        'Synthetic probe failed - critical user journey unavailable',
        this.getStatus(key, false, results),
      );
    }
  }
}
