import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { BackupLog, BackupStatus } from '../entities/backup-log.entity';
import { RecoveryTest, RecoveryTestStatus } from '../entities/recovery-test.entity';

const execAsync = promisify(exec);

export interface RecoveryOptions {
  backupId: string;
  targetDatabase?: string;
  validateOnly?: boolean;
  pointInTime?: Date;
}

export interface RecoveryPlan {
  estimatedDuration: number;
  steps: RecoveryStep[];
  requiredBackups: BackupLog[];
  riskAssessment: string;
}

export interface RecoveryStep {
  order: number;
  description: string;
  command?: string;
  estimatedMinutes: number;
  critical: boolean;
}

@Injectable()
export class DisasterRecoveryService {
  private readonly logger = new Logger(DisasterRecoveryService.name);
  private readonly encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;

  constructor(
    @InjectRepository(BackupLog)
    private backupLogRepository: Repository<BackupLog>,
    @InjectRepository(RecoveryTest)
    private recoveryTestRepository: Repository<RecoveryTest>,
  ) {}

  async createRecoveryPlan(backupId: string): Promise<RecoveryPlan> {
    const backup = await this.backupLogRepository.findOne({ where: { id: backupId } });

    if (!backup) {
      throw new Error('Backup not found');
    }

    const steps: RecoveryStep[] = [
      {
        order: 1,
        description: 'Verify backup integrity and checksum',
        estimatedMinutes: 5,
        critical: true,
      },
      {
        order: 2,
        description: 'Decrypt backup file',
        estimatedMinutes: 10,
        critical: true,
      },
      {
        order: 3,
        description: 'Decompress backup archive',
        estimatedMinutes: 5,
        critical: true,
      },
      {
        order: 4,
        description: 'Stop application services',
        command: 'docker-compose stop app',
        estimatedMinutes: 2,
        critical: true,
      },
      {
        order: 5,
        description: 'Create database backup of current state',
        estimatedMinutes: 15,
        critical: true,
      },
      {
        order: 6,
        description: 'Restore database from backup',
        estimatedMinutes: 30,
        critical: true,
      },
      {
        order: 7,
        description: 'Verify data integrity post-restore',
        estimatedMinutes: 10,
        critical: true,
      },
      {
        order: 8,
        description: 'Restart application services',
        command: 'docker-compose up -d app',
        estimatedMinutes: 5,
        critical: true,
      },
      {
        order: 9,
        description: 'Run health checks and validation',
        estimatedMinutes: 10,
        critical: true,
      },
      {
        order: 10,
        description: 'Verify HIPAA compliance and audit logs',
        estimatedMinutes: 5,
        critical: true,
      },
    ];

    const estimatedDuration = steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);

    return {
      estimatedDuration,
      steps,
      requiredBackups: [backup],
      riskAssessment: 'Medium - Requires application downtime. Ensure all users are notified.',
    };
  }

  async performRecovery(options: RecoveryOptions, performedBy: string): Promise<RecoveryTest> {
    const backup = await this.backupLogRepository.findOne({ where: { id: options.backupId } });

    if (!backup || backup.status !== BackupStatus.VERIFIED) {
      throw new Error('Backup not found or not verified');
    }

    const recoveryTest = this.recoveryTestRepository.create({
      backupId: options.backupId,
      status: RecoveryTestStatus.IN_PROGRESS,
      testType: options.validateOnly ? 'validation' : 'full_recovery',
      testResults: {},
      testedBy: performedBy,
    });

    await this.recoveryTestRepository.save(recoveryTest);

    try {
      this.logger.log(`Starting recovery from backup ${options.backupId}`);

      // Step 1: Verify backup integrity
      const integrityValid = await this.verifyBackupIntegrity(backup);
      if (!integrityValid) {
        throw new Error('Backup integrity check failed');
      }

      // Step 2: Decrypt backup
      const decryptedPath = await this.decryptBackup(backup.backupPath);

      // Step 3: Decompress backup
      const decompressedPath = await this.decompressBackup(decryptedPath);

      if (options.validateOnly) {
        // Validation only - test restore to temporary database
        await this.testRestore(decompressedPath);
      } else {
        // Full recovery
        await this.restoreDatabase(decompressedPath, options.targetDatabase);
      }

      recoveryTest.status = RecoveryTestStatus.PASSED;
      recoveryTest.completedAt = new Date();
      recoveryTest.durationSeconds = Math.floor(
        (recoveryTest.completedAt.getTime() - recoveryTest.startedAt.getTime()) / 1000,
      );
      recoveryTest.testResults = {
        integrityCheck: 'passed',
        decryption: 'passed',
        decompression: 'passed',
        restoration: 'passed',
      };

      await this.recoveryTestRepository.save(recoveryTest);

      this.logger.log(`Recovery completed successfully`);

      // Cleanup temporary files
      await this.cleanupTempFiles([decryptedPath, decompressedPath]);

      return recoveryTest;
    } catch (error) {
      recoveryTest.status = RecoveryTestStatus.FAILED;
      recoveryTest.errorMessage = error.message;
      recoveryTest.completedAt = new Date();
      await this.recoveryTestRepository.save(recoveryTest);

      this.logger.error(`Recovery failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async verifyBackupIntegrity(backup: BackupLog): Promise<boolean> {
    try {
      const fileBuffer = await fs.readFile(backup.backupPath);
      const hash = crypto.createHash('sha256');
      hash.update(fileBuffer);
      const checksum = hash.digest('hex');

      return checksum === backup.checksum;
    } catch (error) {
      this.logger.error(`Integrity verification failed: ${error.message}`);
      return false;
    }
  }

  private async decryptBackup(encryptedPath: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Backup encryption key not configured');
    }

    const outputPath = encryptedPath.replace('.enc.gz', '.dec');
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);

    // Decompress first
    await execAsync(`gunzip -c ${encryptedPath} > ${encryptedPath.replace('.gz', '')}`);

    const encryptedData = await fs.readFile(encryptedPath.replace('.gz', ''));

    // Extract IV, auth tag, and encrypted data
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    await fs.writeFile(outputPath, decrypted);

    return outputPath;
  }

  private async decompressBackup(compressedPath: string): Promise<string> {
    const outputPath = compressedPath.replace('.gz', '');
    await execAsync(`gunzip -c ${compressedPath} > ${outputPath}`);
    return outputPath;
  }

  private async testRestore(backupPath: string): Promise<void> {
    const testDbName = `test_restore_${Date.now()}`;
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbUser = process.env.DB_USERNAME || 'medical_user';

    try {
      // Create test database
      await execAsync(`createdb -h ${dbHost} -p ${dbPort} -U ${dbUser} ${testDbName}`, {
        env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD },
      });

      // Restore to test database
      await execAsync(
        `pg_restore -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${testDbName} ${backupPath}`,
        { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD } },
      );

      // Verify restoration
      const { stdout } = await execAsync(
        `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${testDbName} -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`,
        { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD } },
      );

      this.logger.log(`Test restore verification: ${stdout}`);
    } finally {
      // Cleanup test database
      try {
        await execAsync(`dropdb -h ${dbHost} -p ${dbPort} -U ${dbUser} ${testDbName}`, {
          env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD },
        });
      } catch (error) {
        this.logger.warn(`Failed to cleanup test database: ${error.message}`);
      }
    }
  }

  private async restoreDatabase(backupPath: string, targetDb?: string): Promise<void> {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbName = targetDb || process.env.DB_NAME || 'healthy_stellar';
    const dbUser = process.env.DB_USERNAME || 'medical_user';

    await execAsync(
      `pg_restore -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --clean --if-exists ${backupPath}`,
      { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD } },
    );
  }

  private async cleanupTempFiles(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        await fs.unlink(path);
      } catch (error) {
        this.logger.warn(`Failed to cleanup temp file ${path}: ${error.message}`);
      }
    }
  }

  async getRecoveryTests(limit: number = 50): Promise<RecoveryTest[]> {
    return this.recoveryTestRepository.find({
      relations: ['backup'],
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  async scheduleRecoveryTest(backupId: string, testedBy: string): Promise<RecoveryTest> {
    return this.performRecovery({ backupId, validateOnly: true }, testedBy);
  }
}
