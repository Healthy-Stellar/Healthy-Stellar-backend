import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as os from 'os';
import { SystemMetric, MetricType, MetricSeverity } from '../entities/system-metric.entity';
import { ClinicalAlertService } from './clinical-alert.service';

@Injectable()
export class SystemHealthService {
  private readonly logger = new Logger(SystemHealthService.name);

  constructor(
    @InjectRepository(SystemMetric)
    private systemMetricRepository: Repository<SystemMetric>,
    private clinicalAlertService: ClinicalAlertService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectSystemMetrics(): Promise<void> {
    try {
      await this.cleanupOldMetrics();
      await Promise.all([
        this.collectCpuMetrics(),
        this.collectMemoryMetrics(),
        this.collectDatabaseMetrics(),
        this.collectApiMetrics(),
      ]);
    } catch (error) {
      this.logger.error('Failed to collect system metrics', error);
    }
  }

  private async collectCpuMetrics(): Promise<void> {
    const cpuUsage = await this.getCpuUsage();
    const severity =
      cpuUsage > 90
        ? MetricSeverity.CRITICAL
        : cpuUsage > 75
          ? MetricSeverity.WARNING
          : MetricSeverity.NORMAL;

    await this.recordMetric({
      metricType: MetricType.CPU_USAGE,
      value: cpuUsage,
      unit: 'percentage',
      severity,
      source: 'system-monitor',
      description: 'System CPU usage percentage',
    });

    if (severity === MetricSeverity.CRITICAL) {
      await this.clinicalAlertService.createSystemAlert(
        'High CPU Usage Detected',
        `System CPU usage is at ${cpuUsage}%`,
        'critical',
      );
    }
  }

  private async collectMemoryMetrics(): Promise<void> {
    const memoryUsage = await this.getMemoryUsage();
    const severity =
      memoryUsage > 85
        ? MetricSeverity.CRITICAL
        : memoryUsage > 70
          ? MetricSeverity.WARNING
          : MetricSeverity.NORMAL;

    await this.recordMetric({
      metricType: MetricType.MEMORY_USAGE,
      value: memoryUsage,
      unit: 'percentage',
      severity,
      source: 'system-monitor',
      description: 'System memory usage percentage',
    });
  }

  private async collectDatabaseMetrics(): Promise<void> {
    const dbConnections = await this.getDatabaseConnections();
    const severity =
      dbConnections > 80
        ? MetricSeverity.CRITICAL
        : dbConnections > 60
          ? MetricSeverity.WARNING
          : MetricSeverity.NORMAL;

    await this.recordMetric({
      metricType: MetricType.DATABASE_CONNECTIONS,
      value: dbConnections,
      unit: 'count',
      severity,
      source: 'database-monitor',
      description: 'Active database connections',
    });
  }

  private async collectApiMetrics(): Promise<void> {
    const responseTime = await this.getAverageApiResponseTime();
    const severity =
      responseTime > 5000
        ? MetricSeverity.CRITICAL
        : responseTime > 2000
          ? MetricSeverity.WARNING
          : MetricSeverity.NORMAL;

    await this.recordMetric({
      metricType: MetricType.API_RESPONSE_TIME,
      value: responseTime,
      unit: 'milliseconds',
      severity,
      source: 'api-monitor',
      description: 'Average API response time',
    });
  }

  private async cleanupOldMetrics(): Promise<void> {
    const retentionDays = Number(process.env.SYSTEM_METRIC_RETENTION_DAYS ?? 30);
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
      return;
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    await this.systemMetricRepository.delete({
      timestamp: LessThan(cutoff),
    });
  }

  private async recordMetric(metricData: Partial<SystemMetric>): Promise<SystemMetric> {
    const metric = this.systemMetricRepository.create(metricData);
    return await this.systemMetricRepository.save(metric);
  }

  async getSystemHealth(): Promise<any> {
    const recentMetrics = await this.systemMetricRepository
      .createQueryBuilder('metric')
      .where('metric.timestamp >= :since', { since: new Date(Date.now() - 5 * 60 * 1000) })
      .orderBy('metric.timestamp', 'DESC')
      .getMany();

    const healthStatus = {
      overall: 'healthy',
      metrics: {},
      alerts: [],
    };

    // Group metrics by type and calculate averages
    const metricGroups = recentMetrics.reduce((groups, metric) => {
      if (!groups[metric.metricType]) {
        groups[metric.metricType] = [];
      }
      groups[metric.metricType].push(metric);
      return groups;
    }, {});

    for (const [type, metrics] of Object.entries(metricGroups)) {
      const avgValue =
        (metrics as SystemMetric[]).reduce((sum, m) => sum + Number(m.value), 0) /
        (metrics as SystemMetric[]).length;
      const latestMetric = (metrics as SystemMetric[])[0];

      healthStatus.metrics[type] = {
        current: Number(latestMetric.value),
        average: avgValue,
        unit: latestMetric.unit,
        severity: latestMetric.severity,
      };

      if (latestMetric.severity !== MetricSeverity.NORMAL) {
        healthStatus.overall = 'degraded';
        healthStatus.alerts.push({
          type,
          severity: latestMetric.severity,
          message: `${type} is ${latestMetric.severity}`,
        });
      }
    }

    return healthStatus;
  }

  private async getCpuUsage(): Promise<number> {
    const loadAvg = os.loadavg()[0] ?? 0;
    const cores = os.cpus().length || 1;
    return Math.min(100, (loadAvg / cores) * 100);
  }

  private async getMemoryUsage(): Promise<number> {
    const total = os.totalmem();
    const free = os.freemem();
    return ((total - free) / total) * 100;
  }

  private async getDatabaseConnections(): Promise<number> {
    try {
      const result = await this.systemMetricRepository.query(
        'SELECT COUNT(*)::int AS count FROM pg_stat_activity',
      );
      return Number(result?.[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }

  private async getAverageApiResponseTime(): Promise<number> {
    try {
      const result = await this.systemMetricRepository.query(
        "SELECT COALESCE(AVG(duration), 0) AS avg_ms FROM pg_stat_statements WHERE query NOT LIKE 'EXPLAIN%'",
      );
      return Number(result?.[0]?.avg_ms ?? 0);
    } catch {
      return 0;
    }
  }

  private async getPatientQueueLength(): Promise<number> {
    try {
      const result = await this.systemMetricRepository.query(
        'SELECT COUNT(*)::int AS count FROM appointments WHERE status = $1',
        ['queued'],
      );
      return Number(result?.[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }
}
