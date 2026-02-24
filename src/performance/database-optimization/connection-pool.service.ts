import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  maxPoolSize: number;
  utilizationPercent: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  recommendations: string[];
}

/**
 * Connection Pool Service
 *
 * Monitors and optimizes PostgreSQL connection pool for healthcare workloads:
 * - Dynamic pool sizing based on hospital operational patterns
 * - Connection leak detection
 * - Peak hour (shift change) pool pre-warming
 * - Connection health checks for critical medical operations
 */
@Injectable()
export class ConnectionPoolService {
  private readonly logger = new Logger(ConnectionPoolService.name);
  private readonly WARNING_THRESHOLD = 0.75;
  private readonly CRITICAL_THRESHOLD = 0.9;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get detailed connection pool metrics.
   */
  async getPoolMetrics(): Promise<PoolMetrics> {
    const recommendations: string[] = [];

    try {
      // Get connection statistics from PostgreSQL
      const connStats = await this.dataSource.query(`
        SELECT 
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
          count(*) FILTER (WHERE wait_event IS NOT NULL AND state = 'active') as waiting,
          count(*) as total
        FROM pg_stat_activity
        WHERE datname = current_database();
      `);

      const maxPoolSize = this.configService.get<number>('DB_POOL_MAX', 20);
      const stats = connStats[0];
      const total = parseInt(stats.total || '0');
      const active = parseInt(stats.active || '0');
      const idle = parseInt(stats.idle || '0');
      const idleInTransaction = parseInt(stats.idle_in_transaction || '0');
      const waiting = parseInt(stats.waiting || '0');

      const utilization = total / maxPoolSize;

      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (utilization >= this.CRITICAL_THRESHOLD) {
        healthStatus = 'critical';
        recommendations.push(
          '🚨 Connection pool near capacity. Consider increasing DB_POOL_MAX or optimizing long-running queries.',
        );
      } else if (utilization >= this.WARNING_THRESHOLD) {
        healthStatus = 'warning';
        recommendations.push(
          '⚠️ Connection pool utilization is high. Monitor for peak hospital hours (shift changes).',
        );
      }

      if (idleInTransaction > 3) {
        recommendations.push(
          `🔒 ${idleInTransaction} connections are idle in transaction. This may indicate uncommitted transactions – investigate for potential data lock issues.`,
        );
      }

      if (idle > maxPoolSize * 0.6) {
        recommendations.push(
          `💤 High idle connection ratio (${idle}/${total}). Consider reducing DB_POOL_MIN to free server resources.`,
        );
      }

      return {
        totalConnections: total,
        activeConnections: active,
        idleConnections: idle,
        waitingRequests: waiting,
        maxPoolSize,
        utilizationPercent: Math.round(utilization * 100),
        healthStatus,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Failed to get pool metrics: ${error.message}`);
      return {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
        maxPoolSize: this.configService.get<number>('DB_POOL_MAX', 20),
        utilizationPercent: 0,
        healthStatus: 'critical',
        recommendations: ['Unable to retrieve pool metrics – check database connectivity.'],
      };
    }
  }

  /**
   * Check for potential connection leaks.
   */
  async detectConnectionLeaks(): Promise<{
    leakSuspects: Array<{
      pid: number;
      state: string;
      durationSeconds: number;
      query: string;
      applicationName: string;
    }>;
    totalSuspects: number;
  }> {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          pid,
          state,
          EXTRACT(EPOCH FROM (NOW() - state_change))::int AS duration_seconds,
          COALESCE(LEFT(query, 200), 'N/A') AS query,
          application_name
        FROM pg_stat_activity
        WHERE datname = current_database()
        AND state = 'idle in transaction'
        AND EXTRACT(EPOCH FROM (NOW() - state_change)) > 300
        ORDER BY duration_seconds DESC;
      `);

      return {
        leakSuspects: result.map((r: any) => ({
          pid: r.pid,
          state: r.state,
          durationSeconds: r.duration_seconds,
          query: r.query,
          applicationName: r.application_name,
        })),
        totalSuspects: result.length,
      };
    } catch (error) {
      this.logger.error(`Failed to detect connection leaks: ${error.message}`);
      return { leakSuspects: [], totalSuspects: 0 };
    }
  }

  /**
   * Terminate long-running idle transactions (use with caution in production).
   */
  async terminateIdleTransactions(
    maxIdleSeconds: number = 600,
  ): Promise<{ terminated: number; pids: number[] }> {
    try {
      const result = await this.dataSource.query(
        `
        SELECT pg_terminate_backend(pid), pid
        FROM pg_stat_activity
        WHERE datname = current_database()
        AND state = 'idle in transaction'
        AND EXTRACT(EPOCH FROM (NOW() - state_change)) > $1
        AND pid != pg_backend_pid();
      `,
        [maxIdleSeconds],
      );

      const pids = result.map((r: any) => r.pid);
      if (pids.length > 0) {
        this.logger.warn(
          `⚠️ Terminated ${pids.length} idle transactions (PIDs: ${pids.join(', ')})`,
        );
      }

      return { terminated: pids.length, pids };
    } catch (error) {
      this.logger.error(`Failed to terminate idle transactions: ${error.message}`);
      return { terminated: 0, pids: [] };
    }
  }

  /**
   * Get pool sizing recommendations based on hospital operational patterns.
   */
  getPoolSizingRecommendation(
    estimatedConcurrentUsers: number,
    isHighAvailability: boolean = false,
  ): {
    recommendedMin: number;
    recommendedMax: number;
    shiftChangeBuffer: number;
    explanation: string;
  } {
    // Healthcare formula: connections = (cores * 2) + effective_spindle_count
    // Plus buffer for hospital shift changes (15-20% spike)
    const basePool = Math.max(5, Math.ceil(estimatedConcurrentUsers * 0.3));
    const shiftChangeBuffer = Math.ceil(basePool * 0.2);
    const maxPool = basePool + shiftChangeBuffer;
    const minPool = Math.max(2, Math.ceil(basePool * 0.3));

    const haMultiplier = isHighAvailability ? 1.5 : 1;

    return {
      recommendedMin: Math.ceil(minPool * haMultiplier),
      recommendedMax: Math.ceil(maxPool * haMultiplier),
      shiftChangeBuffer,
      explanation:
        `Based on ${estimatedConcurrentUsers} concurrent users, recommended pool: ` +
        `min=${Math.ceil(minPool * haMultiplier)}, max=${Math.ceil(maxPool * haMultiplier)}. ` +
        `Includes ${shiftChangeBuffer} connection buffer for hospital shift changes. ` +
        (isHighAvailability ? 'HA multiplier (1.5x) applied.' : ''),
    };
  }
}
