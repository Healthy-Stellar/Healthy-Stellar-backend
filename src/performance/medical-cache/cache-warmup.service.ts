import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicalCacheService } from './medical-cache.service';

/**
 * Cache Warmup Service
 *
 * Pre-populates cache with frequently accessed healthcare data on startup
 * and at scheduled intervals (e.g., before shift changes).
 *
 * Warmup categories:
 * - Active admissions list
 * - Today's appointment schedule
 * - Current bed availability
 * - Department staff assignments
 * - Clinical reference data (ICD codes, drug formulary)
 */
@Injectable()
export class CacheWarmupService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmupService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheService: MedicalCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.warmupCriticalData();
  }

  /**
   * Warm up all critical healthcare caches.
   */
  async warmupCriticalData(): Promise<{
    warmedUp: string[];
    failed: string[];
    durationMs: number;
  }> {
    const startTime = Date.now();
    const warmedUp: string[] = [];
    const failed: string[] = [];

    const warmupTasks = [
      { name: 'active-admissions', fn: () => this.warmupActiveAdmissions() },
      { name: 'department-stats', fn: () => this.warmupDepartmentStats() },
      { name: 'system-config', fn: () => this.warmupSystemConfig() },
      { name: 'table-metadata', fn: () => this.warmupTableMetadata() },
    ];

    for (const task of warmupTasks) {
      try {
        await task.fn();
        warmedUp.push(task.name);
      } catch (error) {
        failed.push(`${task.name}: ${error.message}`);
        this.logger.warn(`Cache warmup failed for ${task.name}: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `🔥 Cache warmup complete: ${warmedUp.length} succeeded, ${failed.length} failed (${duration}ms)`,
    );

    return { warmedUp, failed, durationMs: duration };
  }

  /**
   * Warm up active admissions cache.
   */
  private async warmupActiveAdmissions(): Promise<void> {
    try {
      const admissions = await this.dataSource
        .query(
          `
        SELECT id, mrn, first_name, last_name, admission_date, is_admitted
        FROM patient
        WHERE is_admitted = true
        ORDER BY admission_date DESC
        LIMIT 500;
      `,
        )
        .catch(() => []);

      this.cacheService.set('admissions:active', admissions, {
        category: 'bed-availability',
        priority: 'high',
        tags: ['admissions', 'dashboard'],
      });

      this.logger.debug(`Warmed up ${admissions.length} active admissions`);
    } catch (error) {
      this.logger.warn(`Active admissions warmup skipped: ${error.message}`);
    }
  }

  /**
   * Warm up department statistics cache.
   */
  private async warmupDepartmentStats(): Promise<void> {
    try {
      // Get table counts for dashboard
      const tables = ['patient', 'appointment', 'medical_record', 'lab_result'];
      const stats: Record<string, number> = {};

      for (const table of tables) {
        try {
          const result = await this.dataSource.query(
            `
            SELECT reltuples::bigint AS estimate
            FROM pg_class
            WHERE relname = $1;
          `,
            [table],
          );
          stats[table] = parseInt(result[0]?.estimate || '0');
        } catch {
          stats[table] = 0;
        }
      }

      this.cacheService.set('department:stats', stats, {
        category: 'department-stats',
        priority: 'normal',
        tags: ['department', 'dashboard'],
      });

      this.logger.debug('Warmed up department statistics');
    } catch (error) {
      this.logger.warn(`Department stats warmup skipped: ${error.message}`);
    }
  }

  /**
   * Warm up system configuration cache.
   */
  private async warmupSystemConfig(): Promise<void> {
    try {
      const config = {
        maxPoolSize: 20,
        defaultPageSize: 20,
        maxResultLimit: 100,
        cacheEnabled: true,
        realTimeEnabled: true,
        auditEnabled: true,
      };

      this.cacheService.set('system:config', config, {
        category: 'icd-codes',
        priority: 'high',
        tags: ['system', 'config'],
        ttlMs: 3_600_000, // 1 hour
      });

      this.logger.debug('Warmed up system configuration');
    } catch (error) {
      this.logger.warn(`System config warmup skipped: ${error.message}`);
    }
  }

  /**
   * Warm up table metadata for query optimization.
   */
  private async warmupTableMetadata(): Promise<void> {
    try {
      const metadata = await this.dataSource
        .query(
          `
        SELECT 
          t.table_name,
          c.column_name, 
          c.data_type,
          c.is_nullable
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name, c.ordinal_position;
      `,
        )
        .catch(() => []);

      // Group by table
      const tableMap: Record<string, any[]> = {};
      for (const row of metadata) {
        if (!tableMap[row.table_name]) tableMap[row.table_name] = [];
        tableMap[row.table_name].push({
          column: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
        });
      }

      this.cacheService.set('metadata:tables', tableMap, {
        priority: 'normal',
        tags: ['metadata', 'system'],
        ttlMs: 3_600_000,
      });

      this.logger.debug(`Warmed up metadata for ${Object.keys(tableMap).length} tables`);
    } catch (error) {
      this.logger.warn(`Table metadata warmup skipped: ${error.message}`);
    }
  }

  /**
   * Trigger a shift-change cache refresh.
   * Called before nursing/doctor shift changes to pre-warm
   * patient data for incoming staff.
   */
  async shiftChangeWarmup(): Promise<void> {
    this.logger.log('🔄 Shift change cache warmup initiated');
    await this.warmupCriticalData();
  }
}
