import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { BackupLog, BackupStatus } from '../entities/backup-log.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class BackupVerificationService {
  private readonly logger = new Logger(BackupVerificationService.name);
  private readonly adminEmail = process.env.ADMIN_EMAIL || 'admin@healthystellar.io';

  constructor(
    @InjectRepository(BackupLog)
    private backupLogRepository: Repository<BackupLog>,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 4 * * *') // Daily at 4 AM
  async scheduledVerification() {
    this.logger.log('Starting scheduled backup verification');
    await this.verifyRecentBackups();
  }

  /** Scheduled daily integrity check that validates the latest backup and alerts on failure. */
  @Cron('0 0 * * *') // Daily at midnight
  async dailyLatestBackupIntegrityCheck(): Promise<void> {
    this.logger.log('Starting daily integrity check for latest backup');

    const latestBackup = await this.backupLogRepository.findOne({
      where: [{ status: BackupStatus.COMPLETED }, { status: BackupStatus.VERIFIED }],
      order: { completedAt: 'DESC' },
    });

    if (!latestBackup) {
      this.logger.warn('No completed backup found for daily integrity check');
      await this.sendIntegrityAlert(null, 'No completed backup exists in the system');
      return;
    }

    try {
      const isValid = await this.verifyChecksum(latestBackup.backupPath, latestBackup.checksum);

      if (!isValid) {
        const message =
          `Checksum mismatch for backup ${latestBackup.id} ` +
          `(path: ${latestBackup.backupPath}). Backup may be corrupt.`;
        this.logger.error(message);
        await this.sendIntegrityAlert(latestBackup, message);
        return;
      }

      this.logger.log(
        `Daily integrity check passed for latest backup ${latestBackup.id}`,
      );
    } catch (error) {
      const message = `Integrity check error for backup ${latestBackup.id}: ${error.message}`;
      this.logger.error(message);
      await this.sendIntegrityAlert(latestBackup, message);
    }
  }

  private async sendIntegrityAlert(backup: BackupLog | null, details: string): Promise<void> {
    try {
      await this.notifications.sendEmail(
        this.adminEmail,
        '[ALERT] Backup integrity check failed',
        'backup-integrity-alert',
        {
          backupId: backup?.id ?? 'N/A',
          backupPath: backup?.backupPath ?? 'N/A',
          backupStatus: backup?.status ?? 'N/A',
          details,
          checkedAt: new Date().toISOString(),
        },
      );
    } catch (err) {
      this.logger.error(`Failed to send integrity alert email: ${err.message}`);
    }
  }

  async verifyRecentBackups(): Promise<void> {
    const unverifiedBackups = await this.backupLogRepository.find({
      where: { status: BackupStatus.COMPLETED },
      order: { completedAt: 'DESC' },
    });

    for (const backup of unverifiedBackups) {
      try {
        await this.verifyBackup(backup.id);
      } catch (error) {
        this.logger.error(`Verification failed for backup ${backup.id}: ${error.message}`);
      }
    }
  }

  async verifyBackup(backupId: string, verifiedBy: string = 'system'): Promise<BackupLog> {
    const backup = await this.backupLogRepository.findOne({ where: { id: backupId } });

    if (!backup) {
      throw new Error('Backup not found');
    }

    if (backup.status !== BackupStatus.COMPLETED) {
      throw new Error('Backup is not in completed state');
    }

    try {
      // Check file exists
      await fs.access(backup.backupPath);

      // Verify checksum
      const isValid = await this.verifyChecksum(backup.backupPath, backup.checksum);

      if (!isValid) {
        throw new Error('Checksum verification failed');
      }

      // Verify file size
      const stats = await fs.stat(backup.backupPath);
      if (stats.size !== backup.backupSize) {
        throw new Error('File size mismatch');
      }

      // Verify HIPAA compliance markers
      const hipaaCompliant = await this.verifyHIPAACompliance(backup);

      backup.status = BackupStatus.VERIFIED;
      backup.verifiedAt = new Date();
      backup.verifiedBy = verifiedBy;
      backup.hipaaCompliant = hipaaCompliant;

      await this.backupLogRepository.save(backup);

      this.logger.log(`Backup ${backupId} verified successfully`);

      return backup;
    } catch (error) {
      this.logger.error(`Backup verification failed: ${error.message}`);
      throw error;
    }
  }

  private async verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256');
      hash.update(fileBuffer);
      const actualChecksum = hash.digest('hex');

      return actualChecksum === expectedChecksum;
    } catch (error) {
      this.logger.error(`Checksum verification error: ${error.message}`);
      return false;
    }
  }

  private async verifyHIPAACompliance(backup: BackupLog): Promise<boolean> {
    // Verify encryption
    if (!backup.encrypted) {
      this.logger.warn(`Backup ${backup.id} is not encrypted - HIPAA violation`);
      return false;
    }

    // Verify metadata contains required information
    if (!backup.metadata || !backup.metadata.backupVersion) {
      this.logger.warn(`Backup ${backup.id} missing required metadata`);
      return false;
    }

    // Verify backup is within retention policy
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '90', 10);
    const ageInDays = Math.floor((Date.now() - backup.startedAt.getTime()) / (1000 * 60 * 60 * 24));

    if (ageInDays > retentionDays) {
      this.logger.warn(`Backup ${backup.id} exceeds retention policy`);
      return false;
    }

    return true;
  }

  async getVerificationStatus(): Promise<{
    totalBackups: number;
    verifiedBackups: number;
    unverifiedBackups: number;
    failedBackups: number;
  }> {
    const [totalBackups, verifiedBackups, unverifiedBackups, failedBackups] = await Promise.all([
      this.backupLogRepository.count(),
      this.backupLogRepository.count({ where: { status: BackupStatus.VERIFIED } }),
      this.backupLogRepository.count({ where: { status: BackupStatus.COMPLETED } }),
      this.backupLogRepository.count({ where: { status: BackupStatus.FAILED } }),
    ]);

    return {
      totalBackups,
      verifiedBackups,
      unverifiedBackups,
      failedBackups,
    };
  }
}
