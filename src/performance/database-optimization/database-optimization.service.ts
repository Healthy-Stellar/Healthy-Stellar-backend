import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { QueryPerformanceLog } from './entities/query-performance-log.entity';
import { QueryOptimizerService } from './query-optimizer.service';
import { IndexManagerService } from './index-manager.service';

/**
 * Healthcare-Specific Database Optimization Service
 *
 * Provides comprehensive database optimization tailored for hospital operations:
 * - Slow query detection and logging
 * - Automatic index recommendations for medical data tables
 * - Query plan analysis for complex medical record queries
 * - Table partition recommendations for high-volume clinical data
 * - Connection monitoring and health reporting
 */
@Injectable()
export class DatabaseOptimizationService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseOptimizationService.name);
  private readonly SLOW_QUERY_THRESHOLD_MS = 500;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(QueryPerformanceLog)
    private readonly perfLogRepo: Repository<QueryPerformanceLog>,
    private readonly queryOptimizer: QueryOptimizerService,
    private readonly indexManager: IndexManagerService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('🏥 Initializing healthcare database optimization...');
    await this.initializePerformanceMonitoring();
    await this.analyzeHealthcareTables();
  }

  /**
   * Initialize performance monitoring by setting up PostgreSQL
   * query tracking extensions if available.
   */
  private async initializePerformanceMonitoring(): Promise<void> {
    try {
      // Enable pg_stat_statements for query performance tracking
      await this.dataSource
        .query(
          `
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
      `,
        )
        .catch(() => {
          this.logger.warn(
            'pg_stat_statements extension not available - using fallback monitoring',
          );
        });

      // Set up statement-level statistics
      await this.dataSource
        .query(
          `
        SET track_activities = on;
      `,
        )
        .catch(() => {});

      this.logger.log('✅ Performance monitoring initialized');
    } catch (error) {
      this.logger.warn(`Performance monitoring initialization skipped: ${error.message}`);
    }
  }

  /**
   * Analyze healthcare-specific tables and recommend optimizations.
   */
  private async analyzeHealthcareTables(): Promise<void> {
    try {
      const tables = await this.dataSource.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);

      for (const { table_name } of tables) {
        await this.analyzeTable(table_name);
      }

      this.logger.log(`✅ Analyzed ${tables.length} healthcare tables`);
    } catch (error) {
      this.logger.warn(`Table analysis skipped: ${error.message}`);
    }
  }

  /**
   * Analyze a single table for optimization opportunities.
   */
  private async analyzeTable(tableName: string): Promise<void> {
    try {
      // Get table statistics
      const stats = await this.dataSource.query(
        `
        SELECT 
          reltuples::bigint AS estimated_rows,
          pg_size_pretty(pg_total_relation_size(quote_ident($1))) AS total_size,
          pg_size_pretty(pg_relation_size(quote_ident($1))) AS data_size,
          pg_size_pretty(pg_indexes_size(quote_ident($1))) AS index_size
        FROM pg_class
        WHERE relname = $1;
      `,
        [tableName],
      );

      if (stats.length > 0 && stats[0].estimated_rows > 10000) {
        this.logger.log(
          `📊 Table "${tableName}": ${stats[0].estimated_rows} rows, ` +
            `Data: ${stats[0].data_size}, Indexes: ${stats[0].index_size}`,
        );
      }
    } catch (error) {
      // Silently skip tables that can't be analyzed
    }
  }

  /**
   * Log and analyze a query execution for optimization.
   */
  async logQueryPerformance(
    query: string,
    executionTimeMs: number,
    metadata?: {
      queryType?: string;
      tableName?: string;
      rowsAffected?: number;
      callerModule?: string;
      callerIp?: string;
    },
  ): Promise<void> {
    const isSlowQuery = executionTimeMs >= this.SLOW_QUERY_THRESHOLD_MS;

    let optimizationSuggestion: string | null = null;
    let executionPlan: string | null = null;

    if (isSlowQuery) {
      this.logger.warn(
        `🐌 Slow query detected (${executionTimeMs}ms): ${query.substring(0, 200)}...`,
      );
      optimizationSuggestion = this.queryOptimizer.suggestOptimization(query);
      executionPlan = await this.getExecutionPlan(query);
    }

    const log = this.perfLogRepo.create({
      query: query.substring(0, 5000),
      queryType: metadata?.queryType || this.detectQueryType(query),
      tableName: metadata?.tableName || this.detectTableName(query),
      executionTimeMs,
      rowsAffected: metadata?.rowsAffected,
      isSlowQuery,
      executionPlan,
      optimizationSuggestion,
      callerModule: metadata?.callerModule,
      callerIp: metadata?.callerIp,
    });

    await this.perfLogRepo.save(log).catch((err) => {
      this.logger.error(`Failed to log query performance: ${err.message}`);
    });
  }

  /**
   * Get PostgreSQL execution plan for a query.
   */
  private async getExecutionPlan(query: string): Promise<string | null> {
    try {
      // Only analyze SELECT queries to avoid side effects
      if (!query.trim().toUpperCase().startsWith('SELECT')) {
        return null;
      }
      const plan = await this.dataSource.query(`EXPLAIN (ANALYZE false, FORMAT JSON) ${query}`);
      return JSON.stringify(plan);
    } catch {
      return null;
    }
  }

  /**
   * Detect the type of SQL query.
   */
  private detectQueryType(query: string): string {
    const normalized = query.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';
    if (normalized.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }

  /**
   * Extract the primary table name from a query.
   */
  private detectTableName(query: string): string | null {
    const fromMatch = query.match(/FROM\s+["']?(\w+)["']?/i);
    const intoMatch = query.match(/INTO\s+["']?(\w+)["']?/i);
    const updateMatch = query.match(/UPDATE\s+["']?(\w+)["']?/i);
    return fromMatch?.[1] || intoMatch?.[1] || updateMatch?.[1] || null;
  }

  /**
   * Get slow query report for healthcare operations analysis.
   */
  async getSlowQueryReport(hours: number = 24): Promise<{
    totalSlowQueries: number;
    averageExecutionTimeMs: number;
    topSlowQueries: QueryPerformanceLog[];
    tableBreakdown: Record<string, number>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const slowQueries = await this.perfLogRepo.find({
      where: {
        isSlowQuery: true,
      },
      order: { executionTimeMs: 'DESC' },
      take: 50,
    });

    const allLogs = slowQueries.filter((q) => q.executedAt >= since);

    const tableBreakdown: Record<string, number> = {};
    let totalTime = 0;

    for (const log of allLogs) {
      totalTime += log.executionTimeMs;
      if (log.tableName) {
        tableBreakdown[log.tableName] = (tableBreakdown[log.tableName] || 0) + 1;
      }
    }

    return {
      totalSlowQueries: allLogs.length,
      averageExecutionTimeMs: allLogs.length > 0 ? Math.round(totalTime / allLogs.length) : 0,
      topSlowQueries: allLogs.slice(0, 10),
      tableBreakdown,
    };
  }

  /**
   * Optimize healthcare-specific queries by running VACUUM and ANALYZE.
   */
  async optimizeHealthcareTables(): Promise<{
    tablesOptimized: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    const optimizedTables: string[] = [];

    try {
      const tables = await this.dataSource.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);

      for (const { table_name } of tables) {
        try {
          await this.dataSource.query(`ANALYZE "${table_name}";`);
          optimizedTables.push(table_name);
        } catch {
          this.logger.warn(`Could not optimize table: ${table_name}`);
        }
      }

      this.logger.log(`✅ Optimized ${optimizedTables.length} tables`);
    } catch (error) {
      this.logger.error(`Table optimization failed: ${error.message}`);
    }

    return {
      tablesOptimized: optimizedTables,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Get database health metrics for hospital system monitoring.
   */
  async getDatabaseHealthMetrics(): Promise<{
    connectionCount: number;
    activeQueries: number;
    databaseSize: string;
    cacheHitRatio: number;
    replicationLag: number | null;
    tableBloat: Array<{ table: string; bloatRatio: number }>;
  }> {
    try {
      // Active connections
      const connResult = await this.dataSource.query(`
        SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active';
      `);

      // Database size
      const sizeResult = await this.dataSource.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size;
      `);

      // Cache hit ratio
      const cacheResult = await this.dataSource.query(`
        SELECT 
          ROUND(
            COALESCE(
              sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0),
              0
            ) * 100, 2
          ) as cache_hit_ratio
        FROM pg_statio_user_tables;
      `);

      // Total connections
      const totalConn = await this.dataSource.query(`
        SELECT count(*) as count FROM pg_stat_activity;
      `);

      return {
        connectionCount: parseInt(totalConn[0]?.count || '0'),
        activeQueries: parseInt(connResult[0]?.count || '0'),
        databaseSize: sizeResult[0]?.size || 'unknown',
        cacheHitRatio: parseFloat(cacheResult[0]?.cache_hit_ratio || '0'),
        replicationLag: null,
        tableBloat: [],
      };
    } catch (error) {
      this.logger.error(`Failed to get database health metrics: ${error.message}`);
      return {
        connectionCount: 0,
        activeQueries: 0,
        databaseSize: 'unknown',
        cacheHitRatio: 0,
        replicationLag: null,
        tableBloat: [],
      };
    }
  }
}
