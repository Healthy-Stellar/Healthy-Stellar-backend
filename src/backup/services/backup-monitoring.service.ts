import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { BackupLog, BackupStatus } from '../entities/backup-log.entity';
import { RecoveryTest, RecoveryTestStatus } from '../entities/recovery-test.entity';

export interface BackupHealthMetrics {
  lastBackupTime: Date;
  lastSuccessfulBackup: Date;
  backupSuccessRate: number;
  averageBackupDuration: number;
  totalBackupSize: number;
  oldestVerifiedBackup: Date;
  recentFailures: number;
  complianceStatus: 'compliant' | 'warning' | 'critical';
  alerts: BackupAlert[];
}

export interface BackupAlert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
}

@Injectable()
export class BackupMonitoringService {
  private readonly logger = new Logger(BackupMonitoringService.name);
  private readonly alerts: BackupAlert[] = [];

  constructor(
    @InjectRepository(BackupLog)
    private backupLogRepository: Repository<BackupLog>,
    @InjectRepository(RecoveryTest)
    private recoveryTestRepository: Repository<RecoveryTest>,
  ) {}

  @Cron('*/15 * * * *') // Every 15 minutes
  async monitorBackupHealth() {
    const metrics = await this.getHealthMetrics();

    // Check for critical issues
    if (metrics.complianceStatus === 'critical') {
      this.logger.error('CRITICAL: Backup system compliance issues detected');
      await this.sendCriticalAlert(metrics);
    } else if (metrics.complianceStatus === 'warning') {
      this.logger.warn('WARNING: Backup system requires attention');
    }

    // Log metrics
    this.logger.log(
      `Backup Health: Success Rate ${metrics.backupSuccessRate}%, Recent Failures: ${metrics.recentFailures}`,
    );
  }

  async getHealthMetrics(): Promise<BackupHealthMetrics> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get recent backups
    const recentBackups = await this.backupLogRepository.find({
      where: { startedAt: { $gte: last7Days } as any },
      order: { startedAt: 'DESC' },
    });

    const lastBackup = recentBackups[0];
    const successfulBackups = recentBackups.filter((b) => b.status === BackupStatus.VERIFIED);
    const failedBackups = recentBackups.filter((b) => b.status === BackupStatus.FAILED);

    // Calculate metrics
    const backupSuccessRate =
      recentBackups.length > 0 ? (successfulBackups.length / recentBackups.length) * 100 : 0;

    const averageBackupDuration =
      successfulBackups.length > 0
        ? successfulBackups.reduce((sum, b) => sum + (b.durationSeconds || 0), 0) /
          successfulBackups.length
        : 0;

    const totalBackupSize = successfulBackups.reduce((sum, b) => sum + b.backupSize, 0);

    const oldestVerifiedBackup = await this.backupLogRepository.findOne({
      where: { status: BackupStatus.VERIFIED },
      order: { startedAt: 'ASC' },
    });

    const recentFailures = failedBackups.filter((b) => b.startedAt >= last24Hours).length;

    // Generate alerts
    const alerts: BackupAlert[] = [];
    let complianceStatus: 'compliant' | 'warning' | 'critical' = 'compliant';

    // Check last backup time
    if (!lastBackup) {
      alerts.push({
        severity: 'critical',
        message: 'No backups found in the system',
        timestamp: now,
      });
      complianceStatus = 'critical';
    } else {
      const hoursSinceLastBackup =
        (now.getTime() - lastBackup.startedAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastBackup > 24) {
        alerts.push({
          severity: 'critical',
          message: `Last backup was ${Math.floor(hoursSinceLastBackup)} hours ago`,
          timestamp: now,
        });
        complianceStatus = 'critical';
      } else if (hoursSinceLastBackup > 12) {
        alerts.push({
          severity: 'warning',
          message: `Last backup was ${Math.floor(hoursSinceLastBackup)} hours ago`,
          timestamp: now,
        });
        if (complianceStatus !== 'critical') complianceStatus = 'warning';
      }
    }

    // Check success rate
    if (backupSuccessRate < 80) {
      alerts.push({
        severity: 'critical',
        message: `Backup success rate is ${backupSuccessRate.toFixed(1)}% (below 80% threshold)`,
        timestamp: now,
      });
      complianceStatus = 'critical';
    } else if (backupSuccessRate < 95) {
      alerts.push({
        severity: 'warning',
        message: `Backup success rate is ${backupSuccessRate.toFixed(1)}% (below 95% threshold)`,
        timestamp: now,
      });
      if (complianceStatus !== 'critical') complianceStatus = 'warning';
    }

    // Check recent failures
    if (recentFailures > 3) {
      alerts.push({
        severity: 'critical',
        message: `${recentFailures} backup failures in the last 24 hours`,
        timestamp: now,
      });
      complianceStatus = 'critical';
    } else if (recentFailures > 0) {
      alerts.push({
        severity: 'warning',
        message: `${recentFailures} backup failure(s) in the last 24 hours`,
        timestamp: now,
      });
      if (complianceStatus !== 'critical') complianceStatus = 'warning';
    }

    // Check recovery testing
    const lastRecoveryTest = await this.recoveryTestRepository.findOne({
      order: { startedAt: 'DESC' },
    });

    if (!lastRecoveryTest) {
      alerts.push({
        severity: 'warning',
        message: 'No recovery tests have been performed',
        timestamp: now,
      });
      if (complianceStatus !== 'critical') complianceStatus = 'warning';
    } else {
      const daysSinceTest =
        (now.getTime() - lastRecoveryTest.startedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceTest > 30) {
        alerts.push({
          severity: 'warning',
          message: `Last recovery test was ${Math.floor(daysSinceTest)} days ago (recommended: monthly)`,
          timestamp: now,
        });
        if (complianceStatus !== 'critical') complianceStatus = 'warning';
      }
    }

    return {
      lastBackupTime: lastBackup?.startedAt,
      lastSuccessfulBackup: successfulBackups[0]?.completedAt,
      backupSuccessRate,
      averageBackupDuration,
      totalBackupSize,
      oldestVerifiedBackup: oldestVerifiedBackup?.startedAt,
      recentFailures,
      complianceStatus,
      alerts,
    };
  }

  private async sendCriticalAlert(metrics: BackupHealthMetrics): Promise<void> {
    // In production, this would send alerts via email, SMS, PagerDuty, etc.
    this.logger.error('CRITICAL BACKUP ALERT', {
      metrics,
      alerts: metrics.alerts.filter((a) => a.severity === 'critical'),
    });

    // Store alerts for retrieval
    this.alerts.push(...metrics.alerts);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.splice(0, this.alerts.length - 100);
    }
  }

  async getRecentAlerts(limit: number = 50): Promise<BackupAlert[]> {
    return this.alerts.slice(-limit);
  }

  async getBackupStatistics(days: number = 30): Promise<any> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const backups = await this.backupLogRepository.find({
      where: { startedAt: { $gte: cutoffDate } as any },
      order: { startedAt: 'ASC' },
    });

    const byStatus = backups.reduce(
      (acc, backup) => {
        acc[backup.status] = (acc[backup.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const byType = backups.reduce(
      (acc, backup) => {
        acc[backup.backupType] = (acc[backup.backupType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalSize = backups.reduce((sum, b) => sum + b.backupSize, 0);
    const averageSize = backups.length > 0 ? totalSize / backups.length : 0;

    return {
      period: `Last ${days} days`,
      totalBackups: backups.length,
      byStatus,
      byType,
      totalSize,
      averageSize,
      successRate:
        backups.length > 0 ? ((byStatus[BackupStatus.VERIFIED] || 0) / backups.length) * 100 : 0,
    };
  }
}
