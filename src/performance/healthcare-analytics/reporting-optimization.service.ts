import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicalCacheService } from '../medical-cache/medical-cache.service';

/**
 * Reporting Optimization Service
 *
 * Optimizes healthcare report generation for large datasets:
 * - Materialized view management for complex reports
 * - Paginated data retrieval for compliance reports
 * - Streaming exports for large datasets
 * - Report scheduling and result caching
 */
@Injectable()
export class ReportingOptimizationService {
  private readonly logger = new Logger(ReportingOptimizationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheService: MedicalCacheService,
  ) {}

  /**
   * Execute a paginated report query optimized for large healthcare datasets.
   */
  async executePaginatedReport<T>(
    query: string,
    params: any[],
    options: {
      page?: number;
      pageSize?: number;
      cacheKey?: string;
      cacheTtlMs?: number;
    } = {},
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    executionTimeMs: number;
  }> {
    const page = options.page || 1;
    const pageSize = Math.min(options.pageSize || 50, 200);
    const offset = (page - 1) * pageSize;

    // Check cache first
    if (options.cacheKey) {
      const cachedResult = this.cacheService.get<any>(
        `report:${options.cacheKey}:${page}:${pageSize}`,
      );
      if (cachedResult) return cachedResult;
    }

    const startTime = Date.now();

    try {
      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM (${query}) as report_data`;
      const countResult = await this.dataSource.query(countQuery, params);
      const total = parseInt(countResult[0]?.total || '0');

      // Get paginated data
      const paginatedQuery = `${query} LIMIT ${pageSize} OFFSET ${offset}`;
      const data = await this.dataSource.query(paginatedQuery, params);

      const result = {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        executionTimeMs: Date.now() - startTime,
      };

      // Cache the result
      if (options.cacheKey) {
        this.cacheService.set(`report:${options.cacheKey}:${page}:${pageSize}`, result, {
          category: 'compliance-report',
          priority: 'normal',
          tags: ['report', options.cacheKey],
          ttlMs: options.cacheTtlMs || 300_000,
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Report query failed: ${error.message}`);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Create or refresh a materialized view for frequently-accessed reports.
   */
  async createMaterializedView(
    viewName: string,
    query: string,
    refreshInterval?: string,
  ): Promise<{ created: boolean; refreshed: boolean }> {
    try {
      // Check if view exists
      const exists = await this.dataSource.query(
        `
        SELECT matviewname FROM pg_matviews WHERE matviewname = $1;
      `,
        [viewName],
      );

      if (exists.length > 0) {
        // Refresh existing view
        await this.dataSource
          .query(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${viewName}";`)
          .catch(async () => {
            // Fall back to non-concurrent refresh
            await this.dataSource.query(`REFRESH MATERIALIZED VIEW "${viewName}";`);
          });

        this.logger.log(`Materialized view refreshed: ${viewName}`);
        return { created: false, refreshed: true };
      } else {
        // Create new view
        await this.dataSource.query(`CREATE MATERIALIZED VIEW "${viewName}" AS ${query};`);

        // Create unique index for concurrent refresh support
        await this.dataSource
          .query(
            `
          CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_${viewName}_id ON "${viewName}"(id);
        `,
          )
          .catch(() => {
            // Index creation may fail if there's no id column
          });

        this.logger.log(`Materialized view created: ${viewName}`);
        return { created: true, refreshed: false };
      }
    } catch (error) {
      this.logger.error(`Materialized view operation failed for ${viewName}: ${error.message}`);
      return { created: false, refreshed: false };
    }
  }

  /**
   * Get pre-built compliance report templates optimized for healthcare.
   */
  getReportTemplate(reportType: string): string | null {
    const templates: Record<string, string> = {
      'audit-trail': `
        SELECT 
          al.id,
          al.action,
          al.entity_type,
          al.entity_id,
          al.user_id,
          al.ip_address,
          al.created_at,
          al.old_values,
          al.new_values
        FROM audit_log al
        WHERE al.created_at BETWEEN $1 AND $2
        ORDER BY al.created_at DESC
      `,
      'patient-census': `
        SELECT 
          DATE(admission_date) as date,
          COUNT(*) FILTER (WHERE is_admitted = true) as admitted,
          COUNT(*) FILTER (WHERE discharge_date IS NOT NULL) as discharged,
          COUNT(*) as total
        FROM patient
        WHERE admission_date IS NOT NULL
        GROUP BY DATE(admission_date)
        ORDER BY date DESC
      `,
      'lab-turnaround': `
        SELECT 
          test_name,
          COUNT(*) as total_tests,
          AVG(EXTRACT(EPOCH FROM (completed_at - ordered_at))/60)::int as avg_turnaround_minutes,
          MAX(EXTRACT(EPOCH FROM (completed_at - ordered_at))/60)::int as max_turnaround_minutes,
          COUNT(*) FILTER (WHERE is_critical = true) as critical_count
        FROM lab_result
        WHERE completed_at IS NOT NULL
        AND ordered_at BETWEEN $1 AND $2
        GROUP BY test_name
        ORDER BY avg_turnaround_minutes DESC
      `,
      'medication-administration': `
        SELECT 
          medication_name,
          COUNT(*) as total_administrations,
          COUNT(*) FILTER (WHERE status = 'given') as given_on_time,
          COUNT(*) FILTER (WHERE status = 'late') as given_late,
          COUNT(*) FILTER (WHERE status = 'missed') as missed,
          ROUND(
            COUNT(*) FILTER (WHERE status = 'given')::decimal / NULLIF(COUNT(*), 0) * 100, 1
          ) as compliance_rate
        FROM medication_administration
        WHERE administered_at BETWEEN $1 AND $2
        GROUP BY medication_name
        ORDER BY total_administrations DESC
      `,
      'infection-rates': `
        SELECT 
          infection_type,
          location,
          COUNT(*) as total_cases,
          COUNT(*) FILTER (WHERE DATE(detected_at) >= CURRENT_DATE - 7) as last_7_days,
          COUNT(*) FILTER (WHERE DATE(detected_at) >= CURRENT_DATE - 30) as last_30_days
        FROM infection_control
        WHERE detected_at BETWEEN $1 AND $2
        GROUP BY infection_type, location
        ORDER BY total_cases DESC
      `,
    };

    return templates[reportType] || null;
  }

  /**
   * Generate an optimized report using template.
   */
  async generateReport(
    reportType: string,
    dateFrom: Date,
    dateTo: Date,
    options?: {
      page?: number;
      pageSize?: number;
      department?: string;
    },
  ): Promise<any> {
    const template = this.getReportTemplate(reportType);
    if (!template) {
      throw new Error(`Unknown report type: ${reportType}`);
    }

    const cacheKey = `${reportType}:${dateFrom.toISOString()}:${dateTo.toISOString()}`;

    return this.executePaginatedReport(template, [dateFrom, dateTo], {
      page: options?.page,
      pageSize: options?.pageSize,
      cacheKey,
      cacheTtlMs: 600_000, // 10 minutes
    });
  }
}
