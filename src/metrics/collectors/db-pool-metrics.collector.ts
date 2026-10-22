import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';

export const DbPoolSizeGauge = makeGaugeProvider({
  name: 'pg_pool_size',
  help: 'Total number of connections in the database connection pool',
  labelNames: ['database'],
});

export const DbPoolCheckedOutGauge = makeGaugeProvider({
  name: 'pg_pool_checked_out',
  help: 'Number of connections currently checked out from the pool',
  labelNames: ['database'],
});

export const DbPoolIdleGauge = makeGaugeProvider({
  name: 'pg_pool_idle',
  help: 'Number of idle connections waiting in the pool',
  labelNames: ['database'],
});

const POLL_INTERVAL_MS = 15_000;

@Injectable()
export class DbPoolMetricsCollector implements OnModuleInit {
  private readonly logger = new Logger(DbPoolMetricsCollector.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectMetric('pg_pool_size') private readonly poolSizeGauge: Gauge<string>,
    @InjectMetric('pg_pool_checked_out') private readonly checkedOutGauge: Gauge<string>,
    @InjectMetric('pg_pool_idle') private readonly idleGauge: Gauge<string>,
  ) {}

  async onModuleInit() {
    await this.collectPoolMetrics();
  }

  @Interval(POLL_INTERVAL_MS)
  async collectPoolMetrics() {
    try {
      // TypeORM uses the `pg` driver; the pool is accessible via the underlying driver
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pool = (this.dataSource.driver as any).master;
      if (!pool) return;

      const dbName = this.dataSource.options.database as string;
      const totalCount: number = pool.totalCount ?? 0;
      const idleCount: number = pool.idleCount ?? 0;
      const waitingCount: number = pool.waitingCount ?? 0;
      const checkedOut = totalCount - idleCount - waitingCount;

      this.poolSizeGauge.set({ database: dbName }, totalCount);
      this.checkedOutGauge.set({ database: dbName }, Math.max(0, checkedOut));
      this.idleGauge.set({ database: dbName }, idleCount);
    } catch (err) {
      this.logger.warn(`Failed to collect pool metrics: ${(err as Error).message}`);
    }
  }
}
