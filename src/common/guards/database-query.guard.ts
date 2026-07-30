import { Injectable, CanActivate, ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Logger } from '../logger/logger.service';

/**
 * Database Query Guard
 * 
 * Enforces database-level performance guardrails:
 * - Sets statement_timeout for each request
 * - Monitors connection pool health
 * - Rejects requests when pool is exhausted
 */
@Injectable()
export class DatabaseQueryGuard implements CanActivate {
  private readonly statementTimeout: number;
  private readonly poolThreshold: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {
    this.statementTimeout = this.configService.get<number>('DB_STATEMENT_TIMEOUT_MS', 10000);
    this.poolThreshold = this.configService.get<number>('DB_POOL_THRESHOLD', 0.8);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Check connection pool health
    const poolStatus = await this.checkPoolHealth();
    if (!poolStatus.healthy) {
      this.logger.error('Database pool exhausted', {
        ...poolStatus,
        path: request.url,
        context: 'DatabaseQueryGuard',
      });

      throw new ServiceUnavailableException(
        'Database connection pool exhausted. Please try again later.',
      );
    }

    // Set statement timeout for this request
    try {
      await this.dataSource.query(
        `SET LOCAL statement_timeout = ${this.statementTimeout}`,
      );
    } catch (error) {
      this.logger.warn('Failed to set statement timeout', {
        error: error.message,
        context: 'DatabaseQueryGuard',
      });
    }

    return true;
  }

  private async checkPoolHealth(): Promise<{
    healthy: boolean;
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    utilizationPercent: number;
  }> {
    try {
      const driver = this.dataSource.driver as any;
      const pool = driver.master;

      const totalConnections = pool.totalCount || 0;
      const idleConnections = pool.idleCount || 0;
      const activeConnections = totalConnections - idleConnections;
      const maxConnections = this.configService.get<number>('DB_POOL_MAX', 10);
      const utilizationPercent = (activeConnections / maxConnections) * 100;

      const healthy = utilizationPercent < this.poolThreshold * 100;

      if (!healthy) {
        this.logger.warn('High database pool utilization', {
          totalConnections,
          activeConnections,
          idleConnections,
          utilizationPercent: utilizationPercent.toFixed(2),
          threshold: (this.poolThreshold * 100).toFixed(2),
          context: 'DatabaseQueryGuard',
        });
      }

      return {
        healthy,
        totalConnections,
        activeConnections,
        idleConnections,
        utilizationPercent,
      };
    } catch (error) {
      this.logger.error('Failed to check pool health', {
        error: error.message,
        context: 'DatabaseQueryGuard',
      });

      // Fail open - allow request to proceed
      return {
        healthy: true,
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        utilizationPercent: 0,
      };
    }
  }
}
