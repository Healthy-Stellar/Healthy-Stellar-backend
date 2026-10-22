import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import {
  OperationalDashboardDto,
  UtilizationTrendDto,
} from '../dto/operational-dashboard.dto';

@Injectable()
export class OperationalDashboardService {
  private readonly logger = new Logger(OperationalDashboardService.name);
  private readonly bedWarningThreshold: number;
  private readonly orWarningThreshold: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.bedWarningThreshold = this.configService.get<number>('DASHBOARD_BED_WARNING_THRESHOLD', 85);
    this.orWarningThreshold = this.configService.get<number>('DASHBOARD_OR_WARNING_THRESHOLD', 80);
  }

  async getLiveDashboard(tenantId: string): Promise<OperationalDashboardDto> {
    const [bedStats, orStats] = await Promise.all([
      this.getBedStats(),
      this.getOrStats(),
    ]);

    const bedRate = bedStats.total > 0 ? (bedStats.occupied / bedStats.total) * 100 : 0;
    const orRate = orStats.total > 0 ? (orStats.occupied / orStats.total) * 100 : 0;

    const bedRateRounded = Math.round(bedRate * 10) / 10;
    const orRateRounded = Math.round(orRate * 10) / 10;

    const alerts: string[] = [];
    if (bedRate >= this.bedWarningThreshold) {
      alerts.push(
        `Bed utilization at ${bedRateRounded}% — above ${this.bedWarningThreshold}% threshold`,
      );
    }
    if (orRate >= this.orWarningThreshold) {
      alerts.push(
        `OR utilization at ${orRateRounded}% — above ${this.orWarningThreshold}% threshold`,
      );
    }

    return {
      tenantId,
      asOf: new Date().toISOString(),
      bedUtilization: {
        ...bedStats,
        utilizationRate: bedRateRounded,
        warningThresholdBreached: bedRate >= this.bedWarningThreshold,
      },
      orUtilization: {
        ...orStats,
        utilizationRate: orRateRounded,
        warningThresholdBreached: orRate >= this.orWarningThreshold,
      },
      alerts,
    };
  }

  async getHistoricalTrend(tenantId: string, days: number): Promise<UtilizationTrendDto> {
    const [bedTrend, orTrend] = await Promise.all([
      this.dataSource
        .query<{ date: string; occupied: string; total: string }[]>(
          `SELECT
             date_trunc('day', b."assignedAt")::date::text AS date,
             COUNT(*) FILTER (WHERE b.status = 'occupied') AS occupied,
             COUNT(*) AS total
           FROM beds b
           WHERE b."assignedAt" IS NOT NULL
             AND b."assignedAt" >= NOW() - ($1 || ' days')::interval
           GROUP BY date_trunc('day', b."assignedAt")
           ORDER BY 1`,
          [days],
        )
        .catch(() => [] as { date: string; occupied: string; total: string }[]),
      this.dataSource
        .query<{ date: string; occupied: string; total: string }[]>(
          `SELECT
             sc."scheduledDate"::date::text AS date,
             COUNT(*) FILTER (WHERE sc.status IN ('IN_PROGRESS', 'COMPLETED')) AS occupied,
             COUNT(*) AS total
           FROM surgical_cases sc
           WHERE sc."scheduledDate" >= NOW() - ($1 || ' days')::interval
           GROUP BY sc."scheduledDate"::date
           ORDER BY 1`,
          [days],
        )
        .catch(() => [] as { date: string; occupied: string; total: string }[]),
    ]);

    const bedMap = new Map(bedTrend.map((r) => [r.date, { occupied: +r.occupied, total: +r.total }]));
    const orMap = new Map(orTrend.map((r) => [r.date, { occupied: +r.occupied, total: +r.total }]));

    const dates = new Set([...bedMap.keys(), ...orMap.keys()]);
    const trend = [...dates].sort().map((date) => {
      const bed = bedMap.get(date) ?? { occupied: 0, total: 0 };
      const or = orMap.get(date) ?? { occupied: 0, total: 0 };
      return {
        date,
        bedUtilizationRate: bed.total > 0 ? Math.round((bed.occupied / bed.total) * 1000) / 10 : 0,
        orUtilizationRate: or.total > 0 ? Math.round((or.occupied / or.total) * 1000) / 10 : 0,
      };
    });

    return { trend };
  }

  async publishDashboardUpdate(tenantId: string): Promise<void> {
    const dashboard = await this.getLiveDashboard(tenantId);
    this.eventEmitter.emit('operational.dashboard.update', { tenantId, dashboard });
    this.logger.debug(`Published dashboard update for tenant ${tenantId}`);
  }

  private async getBedStats(): Promise<{ total: number; occupied: number; available: number }> {
    const rows = await this.dataSource
      .query<{ total: string; occupied: string }[]>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'occupied') AS occupied
         FROM beds
         WHERE "isActive" = true`,
      )
      .catch(() => [{ total: '0', occupied: '0' }]);

    const row = rows[0] ?? { total: '0', occupied: '0' };
    const total = +row.total;
    const occupied = +row.occupied;
    return { total, occupied, available: total - occupied };
  }

  private async getOrStats(): Promise<{
    total: number;
    occupied: number;
    available: number;
    upcomingCases: number;
  }> {
    const [orRows, caseRows] = await Promise.all([
      this.dataSource
        .query<{ total: string; occupied: string }[]>(
          `SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE status = 'OCCUPIED') AS occupied
           FROM operating_rooms
           WHERE "isActive" = true`,
        )
        .catch(() => [{ total: '0', occupied: '0' }]),
      this.dataSource
        .query<{ upcoming: string }[]>(
          `SELECT COUNT(*) AS upcoming
           FROM surgical_cases
           WHERE status = 'SCHEDULED'
             AND "scheduledDate" > NOW()
             AND "scheduledDate" <= NOW() + INTERVAL '24 hours'`,
        )
        .catch(() => [{ upcoming: '0' }]),
    ]);

    const orRow = orRows[0] ?? { total: '0', occupied: '0' };
    const total = +orRow.total;
    const occupied = +orRow.occupied;
    return {
      total,
      occupied,
      available: total - occupied,
      upcomingCases: +(caseRows[0]?.upcoming ?? '0'),
    };
  }
}
