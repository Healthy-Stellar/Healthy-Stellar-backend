import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DataQualityReport,
  ClinicalAlertEntity,
  GovernanceComplianceLog,
} from '../entities/medical-validation.entities';

export interface MonitoringDashboard {
  generatedAt: Date;
  dataQuality: {
    averageScoreByType: Record<string, number>;
    failingRecords: number;
    passingRate: number;
  };
  clinicalAlerts: {
    openAlerts: number;
    criticalAlerts: number;
    alertsByType: Record<string, number>;
    avgResolutionTimeHours: number;
  };
  governance: {
    overallComplianceRate: number;
    recentViolations: number;
    criticalViolations: number;
  };
}

@Injectable()
export class MedicalMonitoringService {
  private readonly logger = new Logger(MedicalMonitoringService.name);

  constructor(
    @InjectRepository(DataQualityReport)
    private readonly qualityReportRepo: Repository<DataQualityReport>,
    @InjectRepository(ClinicalAlertEntity)
    private readonly alertRepo: Repository<ClinicalAlertEntity>,
    @InjectRepository(GovernanceComplianceLog)
    private readonly complianceLogRepo: Repository<GovernanceComplianceLog>,
  ) {}

  async getDashboard(days: number = 7): Promise<MonitoringDashboard> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [dataQuality, clinicalAlerts, governance] = await Promise.all([
      this.getDataQualityMetrics(since),
      this.getClinicalAlertMetrics(since),
      this.getGovernanceMetrics(since),
    ]);

    return {
      generatedAt: new Date(),
      dataQuality,
      clinicalAlerts,
      governance,
    };
  }

  async getDataCompletenessReport(recordType?: string): Promise<{
    totalRecords: number;
    passingRecords: number;
    passingRate: number;
    averageScore: number;
    bottomRecords: { recordId: string; score: number; issueCount: number }[];
  }> {
    const qb = this.qualityReportRepo.createQueryBuilder('r');

    if (recordType) {
      qb.where('r.recordType = :recordType', { recordType });
    }

    const reports = await qb.getMany();

    if (reports.length === 0) {
      return { totalRecords: 0, passingRecords: 0, passingRate: 100, averageScore: 100, bottomRecords: [] };
    }

    const totalRecords = reports.length;
    const passingRecords = reports.filter((r) => r.isPassing).length;
    const passingRate = (passingRecords / totalRecords) * 100;
    const averageScore =
      reports.reduce((sum, r) => sum + Number(r.overallScore), 0) / totalRecords;

    // Bottom 10 records by score
    const bottomRecords = reports
      .sort((a, b) => Number(a.overallScore) - Number(b.overallScore))
      .slice(0, 10)
      .map((r) => ({
        recordId: r.recordId,
        score: Number(r.overallScore),
        issueCount: (r.issues as unknown[]).length,
      }));

    return {
      totalRecords,
      passingRecords,
      passingRate: Math.round(passingRate * 100) / 100,
      averageScore: Math.round(averageScore * 100) / 100,
      bottomRecords,
    };
  }

  /**
   * Scheduled daily monitoring report
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyMonitoringReport(): Promise<void> {
    this.logger.log('Generating daily medical data monitoring report...');

    try {
      const dashboard = await this.getDashboard(1); // last 24 hours

      this.logger.log(
        `Daily Report Summary:
        - Data Quality Passing Rate: ${dashboard.dataQuality.passingRate}%
        - Open Clinical Alerts: ${dashboard.clinicalAlerts.openAlerts}
        - Critical Alerts: ${dashboard.clinicalAlerts.criticalAlerts}
        - Governance Compliance Rate: ${dashboard.governance.overallComplianceRate}%`,
      );

      // In production: send to monitoring service, Slack, email, etc.
    } catch (error) {
      this.logger.error('Failed to generate daily monitoring report', error);
    }
  }

  /**
   * Hourly check for unacknowledged critical alerts
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkUnacknowledgedCriticalAlerts(): Promise<void> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const unacknowledgedCritical = await this.alertRepo.count({
      where: {
        severity: 'CRITICAL',
        isResolved: false,
        requiresAcknowledgment: true,
        createdAt: MoreThan(oneHourAgo),
      },
    });

    if (unacknowledgedCritical > 0) {
      this.logger.warn(
        `⚠️ ${unacknowledgedCritical} critical clinical alert(s) have not been acknowledged in the past hour. Escalation required.`,
      );
      // In production: trigger escalation notification
    }
  }

  private async getDataQualityMetrics(since: Date): Promise<MonitoringDashboard['dataQuality']> {
    const reports = await this.qualityReportRepo
      .createQueryBuilder('r')
      .where('r.assessedAt >= :since', { since })
      .select(['r.recordType', 'r.overallScore', 'r.isPassing'])
      .getMany();

    const byType: Record<string, number[]> = {};
    let failingRecords = 0;

    for (const report of reports) {
      if (!byType[report.recordType]) byType[report.recordType] = [];
      byType[report.recordType].push(Number(report.overallScore));
      if (!report.isPassing) failingRecords++;
    }

    const averageScoreByType: Record<string, number> = {};
    for (const [type, scores] of Object.entries(byType)) {
      averageScoreByType[type] =
        Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
    }

    const passingRate =
      reports.length > 0
        ? Math.round(((reports.length - failingRecords) / reports.length) * 100 * 100) / 100
        : 100;

    return { averageScoreByType, failingRecords, passingRate };
  }

  private async getClinicalAlertMetrics(since: Date): Promise<MonitoringDashboard['clinicalAlerts']> {
    const [openAlerts, criticalAlerts, allRecentAlerts, resolvedWithTime] = await Promise.all([
      this.alertRepo.count({ where: { isResolved: false } }),
      this.alertRepo.count({ where: { severity: 'CRITICAL', isResolved: false } }),
      this.alertRepo
        .createQueryBuilder('a')
        .where('a.createdAt >= :since', { since })
        .select(['a.alertType'])
        .getMany(),
      this.alertRepo
        .createQueryBuilder('a')
        .where('a.createdAt >= :since', { since })
        .andWhere('a.isResolved = true')
        .andWhere('a.resolvedAt IS NOT NULL')
        .select(['a.createdAt', 'a.resolvedAt'])
        .getMany(),
    ]);

    const alertsByType: Record<string, number> = {};
    for (const alert of allRecentAlerts) {
      alertsByType[alert.alertType] = (alertsByType[alert.alertType] || 0) + 1;
    }

    let avgResolutionTimeHours = 0;
    if (resolvedWithTime.length > 0) {
      const totalHours = resolvedWithTime.reduce((sum, a) => {
        if (a.resolvedAt) {
          return sum + (new Date(a.resolvedAt).getTime() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60);
        }
        return sum;
      }, 0);
      avgResolutionTimeHours = Math.round((totalHours / resolvedWithTime.length) * 10) / 10;
    }

    return { openAlerts, criticalAlerts, alertsByType, avgResolutionTimeHours };
  }

  private async getGovernanceMetrics(since: Date): Promise<MonitoringDashboard['governance']> {
    const recentLogs = await this.complianceLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.policy', 'policy')
      .where('log.checkedAt >= :since', { since })
      .getMany();

    const totalChecks = recentLogs.length;
    const compliantChecks = recentLogs.filter((l) => l.isCompliant).length;
    const overallComplianceRate =
      totalChecks > 0 ? Math.round((compliantChecks / totalChecks) * 100 * 100) / 100 : 100;

    const recentViolations = totalChecks - compliantChecks;
    const criticalViolations = recentLogs.filter((l) => {
      if (!l.violations) return false;
      return (l.violations as unknown as { severity: string }[]).some((v) => v.severity === 'CRITICAL');
    }).length;

    return { overallComplianceRate, recentViolations, criticalViolations };
  }
}
