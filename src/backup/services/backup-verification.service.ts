import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { BackupLog, BackupStatus } from '../entities/backup-log.entity';

@Injectable()
export class BackupVerificationService {
  private readonly logger = new Logger(BackupVerificationService.name);

  constructor(
    @InjectRepository(BackupLog)
    private backupLogRepository: Repository<BackupLog>,
  ) {}

  @Cron('0 4 * * *') // Daily at 4 AM
  async scheduledVerification() {
    this.logger.log('Starting scheduled backup verification');
    await this.verifyRecentBackups();
  }

  async verifyRecentBackups(): Promise<void> {
    const unverifiedBackups = await this.backupLogRepository.find({
      where: { status: BackupStatus.COMPLETED },
      order: { completedAt: 'DESC' },
      take: 10,
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
