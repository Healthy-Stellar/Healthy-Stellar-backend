import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { Cron } from '@nestjs/schedule';
import { BackupLog, BackupStatus, BackupType } from '../entities/backup-log.entity';
import { RecoveryTest, RecoveryTestStatus } from '../entities/recovery-test.entity';

/** Reuse the same validators and shell-free spawn helper from backup.service.ts */
const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

function validateDbHost(value: string): string {
  const ipv4Re = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!HOSTNAME_RE.test(value) && !ipv4Re.test(value))
    throw new Error(`DB_HOST contains invalid characters: "${value}"`);
  return value;
}
function validateDbPort(value: string): string {
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535 || String(port) !== value.trim())
    throw new Error(`DB_PORT is not a valid port number: "${value}"`);
  return value;
}
function validateDbIdentifier(value: string, envVar: string): string {
  if (!IDENTIFIER_RE.test(value))
    throw new Error(`${envVar} contains invalid characters: "${value}"`);
  return value;
}

function spawnAsync(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, env: options.env ?? process.env, stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`))),
    );
  });
}

function spawnAsyncCapture(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = '';
    const child = spawn(command, args, { shell: false, env: options.env ?? process.env, stdio: ['ignore', 'pipe', 'ignore'] });
    child.stdout?.on('data', (d: Buffer) => { out += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${command} exited with code ${code}`))),
    );
  });
}

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

/**
 * Second-confirmation payload required for destructive full recovery.
 * The actor is always derived from the authenticated request (req.user),
 * never from the request body.
 */
export interface RecoveryConfirmation {
  /** Re-authentication: the acting operator's password. */
  password?: string;
  /** Two-person approval: id of a second SUPER_ADMIN who approved the restore. */
  approverId?: string;
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
  ) {
    this.validateRequiredConfiguration();
  }

  private validateRequiredConfiguration(): void {
    if (!this.encryptionKey) {
      throw new Error('BACKUP_ENCRYPTION_KEY environment variable is required for DisasterRecoveryService');
    }
  }

  /**
   * Enforce a second confirmation for destructive full recovery.
   * Accepts either a re-authentication password or a two-person approval
   * (a distinct approver id). The acting user is taken from req.user.
   */
  assertRecoveryConfirmed(actorId: string, confirmation?: RecoveryConfirmation): void {
    if (!confirmation) {
      throw new BadRequestException(
        'Full recovery requires a second confirmation (re-authentication password or approverId)',
      );
    }

    const hasPassword = typeof confirmation.password === 'string' && confirmation.password.length > 0;
    const hasApprover =
      typeof confirmation.approverId === 'string' &&
      confirmation.approverId.length > 0 &&
      confirmation.approverId !== actorId;

    if (!hasPassword && !hasApprover) {
      throw new BadRequestException(
        'Full recovery requires a second confirmation: provide a re-authentication password or a distinct approverId',
      );
    }
  }

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
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      return hash === backup.checksum;
    } catch (error) {
      this.logger.error(`Integrity verification failed: ${error.message}`);
      return false;
    }
  }

  private async decryptBackup(backupPath: string): Promise<string> {
    const decryptedPath = `${backupPath}.decrypted`;
    await spawnAsync('openssl', [
      'enc', '-d', '-aes-256-cbc',
      '-in', backupPath,
      '-out', decryptedPath,
      '-pass', `env:BACKUP_ENCRYPTION_KEY`,
    ]);
    return decryptedPath;
  }

  private async decompressBackup(backupPath: string): Promise<string> {
    const decompressedPath = `${backupPath}.decompressed`;
    await spawnAsync('gunzip', ['-c', backupPath], { env: { ...process.env } });
    return decompressedPath;
  }

  private async testRestore(backupPath: string): Promise<void> {
    const testDb = `test_restore_${Date.now()}`;
    const host = validateDbHost(process.env.DB_HOST ?? 'localhost');
    const port = validateDbPort(process.env.DB_PORT ?? '5432');
    const user = validateDbIdentifier(process.env.DB_USERNAME ?? 'postgres', 'DB_USERNAME');
    validateDbIdentifier(testDb, 'testDb');

    await spawnAsync('createdb', ['-h', host, '-p', port, '-U', user, testDb]);
    try {
      await spawnAsync('psql', ['-h', host, '-p', port, '-U', user, '-d', testDb, '-f', backupPath]);
    } finally {
      await spawnAsync('dropdb', ['-h', host, '-p', port, '-U', user, testDb]);
    }
  }

  private async restoreDatabase(backupPath: string, targetDatabase?: string): Promise<void> {
    const host = validateDbHost(process.env.DB_HOST ?? 'localhost');
    const port = validateDbPort(process.env.DB_PORT ?? '5432');
    const user = validateDbIdentifier(process.env.DB_USERNAME ?? 'postgres', 'DB_USERNAME');
    const db = validateDbIdentifier(targetDatabase ?? process.env.DB_NAME ?? 'postgres', 'targetDatabase');

    await spawnAsync('psql', ['-h', host, '-p', port, '-U', user, '-d', db, '-f', backupPath]);
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
}
