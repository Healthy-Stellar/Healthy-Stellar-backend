import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Logger } from '../logger/logger.service';
import { Counter, Histogram, register } from 'prom-client';

/**
 * Query Performance Monitor
 * 
 * Monitors database query performance and provides metrics:
 * - Tracks slow queries
 * - Provides Prometheus metrics
 * - Alerts on performance degradation
 */
@Injectable()
export class QueryPerformanceMonitor implements OnModuleInit {
  private readonly slowQueryThreshold: number;
  private readonly criticalQueryThreshold: number;
  private slowQueryCounter: Counter;
  private queryDurationHistogram: Histogram;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.slowQueryThreshold = this.configService.get<number>('SLOW_QUERY_THRESHOLD_MS', 1000);
    this.criticalQueryThreshold = this.configService.get<number>('CRITICAL_QUERY_THRESHOLD_MS', 5000);

    // Initialize Prometheus metrics
    this.slowQueryCounter = new Counter({
      name: 'db_slow_queries_total',
      help: 'Total number of slow database queries',
      labelNames: ['severity', 'operation'],
      registers: [register],
    });

    this.queryDurationHistogram = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });
  }

  async onModuleInit() {
    await this.setupQueryLogging();
  }

  private async setupQueryLogging() {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      // Enable pg_stat_statements extension for query tracking
      await queryRunner.query(`
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
      `);

      this.logger.log('Query performance monitoring initialized', {
        context: 'QueryPerformanceMonitor',
      });
    } catch (error) {
      this.logger.warn('Failed to enable pg_stat_statements', {
        error: error.message,
        context: 'QueryPerformanceMonitor',
      });
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Log slow query with appropriate severity
   */
  logSlowQuery(query: string, duration: number, params?: any[]) {
    const severity = duration > this.criticalQueryThreshold ? 'critical' : 'warning';

    this.slowQueryCounter.inc({ severity, operation: this.extractOperation(query) });

    this.logger.warn('Slow query detected', {
      query: this.sanitizeQuery(query),
      duration,
      threshold: this.slowQueryThreshold,
      severity,
      params: params ? this.sanitizeParams(params) : undefined,
      context: 'QueryPerformanceMonitor',
    });

    // Alert on critical queries
    if (duration > this.criticalQueryThreshold) {
      this.logger.error('Critical slow query detected', {
        query: this.sanitizeQuery(query),
        duration,
        threshold: this.criticalQueryThreshold,
        context: 'QueryPerformanceMonitor',
      });
    }
  }

  /**
   * Record query duration metric
   */
  recordQueryDuration(operation: string, duration: number, status: 'success' | 'error') {
    this.queryDurationHistogram.observe(
      { operation, status },
      duration / 1000, // Convert to seconds
    );
  }

  /**
   * Get slow queries from pg_stat_statements
   */
  async getSlowQueries(limit = 10): Promise<any[]> {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          max_exec_time,
          stddev_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > $1
        ORDER BY mean_exec_time DESC
        LIMIT $2
      `, [this.slowQueryThreshold, limit]);

      return result;
    } catch (error) {
      this.logger.error('Failed to fetch slow queries', {
        error: error.message,
        context: 'QueryPerformanceMonitor',
      });
      return [];
    }
  }

  /**
   * Reset pg_stat_statements
   */
  async resetStats(): Promise<void> {
    try {
      await this.dataSource.query('SELECT pg_stat_statements_reset()');
      this.logger.log('Query statistics reset', {
        context: 'QueryPerformanceMonitor',
      });
    } catch (error) {
      this.logger.error('Failed to reset query statistics', {
        error: error.message,
        context: 'QueryPerformanceMonitor',
      });
    }
  }

  private extractOperation(query: string): string {
    const match = query.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
  }

  private sanitizeQuery(query: string): string {
    // Truncate long queries and remove sensitive data
    return query
      .substring(0, 500)
      .replace(/\b\d{16}\b/g, '[CARD]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  }

  private sanitizeParams(params: any[]): any[] {
    return params.map((param) => {
      if (typeof param === 'string' && param.length > 100) {
        return param.substring(0, 100) + '...';
      }
      return param;
    });
  }
}
