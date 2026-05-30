import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BackupLog, BackupType, BackupStatus } from '../entities/backup-log.entity';

/** Strict allowlist validators for database connection env variables. */
const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

function validateDbHost(value: string): string {
  // Allow plain hostnames, FQDNs, and IPv4 addresses
  const ipv4Re = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!HOSTNAME_RE.test(value) && !ipv4Re.test(value)) {
    throw new Error(`DB_HOST contains invalid characters: "${value}"`);
  }
  return value;
}

function validateDbPort(value: string): string {
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535 || String(port) !== value.trim()) {
    throw new Error(`DB_PORT is not a valid port number: "${value}"`);
  }
  return value;
}

function validateDbIdentifier(value: string, envVar: string): string {
  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(`${envVar} contains invalid characters: "${value}"`);
  }
  return value;
}

/**
 * Runs a command safely using spawn (no shell) and resolves/rejects based on
 * the process exit code.  stdout/stderr are forwarded to the provided logger.
 */
function spawnAsync(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; logger?: Logger } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false, // never invoke a shell
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (data: Buffer) => {
      options.logger?.debug(`[${command}] ${data.toString().trim()}`);
    });

    child.stderr?.on('data', (data: Buffer) => {
      options.logger?.debug(`[${command} stderr] ${data.toString().trim()}`);
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = process.env.BACKUP_DIR || '/backups';
  private readonly encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
  private readonly retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '90', 10);

  constructor(
    @InjectRepository(BackupLog)
    private backupLogRepository: Repository<BackupLog>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledFullBackup() {
    this.logger.log('Starting scheduled full backup');
    await this.createFullBackup();
  }

  @Cron('0 */6 * * *') // Every 6 hours
  async scheduledIncrementalBackup() {
    this.logger.log('Starting scheduled incremental backup');
    await this.createIncrementalBackup();
  }

  async createFullBackup(): Promise<BackupLog> {
    const backupLog = this.backupLogRepository.create({
      backupType: BackupType.FULL,
      status: BackupStatus.IN_PROGRESS,
      backupPath: '',
      backupSize: 0,
      encrypted: true,
      compressed: true,
      hipaaCompliant: true,
      metadata: {
        initiatedBy: 'system',
        backupVersion: '1.0',
      },
    });

    await this.backupLogRepository.save(backupLog);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `full_backup_${timestamp}`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // Database backup
      await this.backupDatabase(backupPath);

      // Encrypt backup
      const encryptedPath = await this.encryptBackup(backupPath);

      // Compress backup
      const compressedPath = await this.compressBackup(encryptedPath);

      // Calculate checksum
      const checksum = await this.calculateChecksum(compressedPath);

      // Get file size
      const stats = await fs.stat(compressedPath);

      backupLog.status = BackupStatus.COMPLETED;
      backupLog.backupPath = compressedPath;
      backupLog.backupSize = stats.size;
      backupLog.checksum = checksum;
      backupLog.completedAt = new Date();
      backupLog.durationSeconds = Math.floor(
        (backupLog.completedAt.getTime() - backupLog.startedAt.getTime()) / 1000,
      );

      await this.backupLogRepository.save(backupLog);

      this.logger.log(`Full backup completed: ${compressedPath}`);

      // Cleanup old backups
      await this.cleanupOldBackups();

      return backupLog;
    } catch (error) {
      backupLog.status = BackupStatus.FAILED;
      backupLog.errorMessage = error.message;
      backupLog.completedAt = new Date();
      await this.backupLogRepository.save(backupLog);

      this.logger.error(`Backup failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createIncrementalBackup(): Promise<BackupLog> {
    const lastFullBackup = await this.backupLogRepository.findOne({
      where: { backupType: BackupType.FULL, status: BackupStatus.VERIFIED },
      order: { startedAt: 'DESC' },
    });

    if (!lastFullBackup) {
      this.logger.warn('No verified full backup found, creating full backup instead');
      return this.createFullBackup();
    }

    const backupLog = this.backupLogRepository.create({
      backupType: BackupType.INCREMENTAL,
      status: BackupStatus.IN_PROGRESS,
      backupPath: '',
      backupSize: 0,
      encrypted: true,
      compressed: true,
      hipaaCompliant: true,
      metadata: {
        initiatedBy: 'system',
        baseBackupId: lastFullBackup.id,
        sinceTimestamp: lastFullBackup.completedAt,
      },
    });

    await this.backupLogRepository.save(backupLog);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `incremental_backup_${timestamp}`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // Incremental database backup
      await this.backupDatabaseIncremental(backupPath, lastFullBackup.completedAt);

      const encryptedPath = await this.encryptBackup(backupPath);
      const compressedPath = await this.compressBackup(encryptedPath);
      const checksum = await this.calculateChecksum(compressedPath);
      const stats = await fs.stat(compressedPath);

      backupLog.status = BackupStatus.COMPLETED;
      backupLog.backupPath = compressedPath;
      backupLog.backupSize = stats.size;
      backupLog.checksum = checksum;
      backupLog.completedAt = new Date();
      backupLog.durationSeconds = Math.floor(
        (backupLog.completedAt.getTime() - backupLog.startedAt.getTime()) / 1000,
      );

      await this.backupLogRepository.save(backupLog);

      this.logger.log(`Incremental backup completed: ${compressedPath}`);

      return backupLog;
    } catch (error) {
      backupLog.status = BackupStatus.FAILED;
      backupLog.errorMessage = error.message;
      backupLog.completedAt = new Date();
      await this.backupLogRepository.save(backupLog);

      this.logger.error(`Incremental backup failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async backupDatabase(outputPath: string): Promise<void> {
    const dbHost = validateDbHost(process.env.DB_HOST || 'localhost');
    const dbPort = validateDbPort(process.env.DB_PORT || '5432');
    const dbName = validateDbIdentifier(process.env.DB_NAME || 'healthy_stellar', 'DB_NAME');
    const dbUser = validateDbIdentifier(process.env.DB_USERNAME || 'medical_user', 'DB_USERNAME');

    await spawnAsync(
      'pg_dump',
      [
        '-h', dbHost,
        '-p', dbPort,
        '-U', dbUser,
        '-d', dbName,
        '--format=custom',
        '--verbose',
        '--clean',
        '--no-owner',
        '--no-privileges',
        `--file=${outputPath}.pgdump`,
      ],
      {
        env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD },
        logger: this.logger,
      },
    );
  }

  private async backupDatabaseIncremental(outputPath: string, sinceDate: Date): Promise<void> {
    const dbHost = validateDbHost(process.env.DB_HOST || 'localhost');
    const dbPort = validateDbPort(process.env.DB_PORT || '5432');
    const dbName = validateDbIdentifier(process.env.DB_NAME || 'healthy_stellar', 'DB_NAME');
    const dbUser = validateDbIdentifier(process.env.DB_USERNAME || 'medical_user', 'DB_USERNAME');

    // Timestamp-filtered logical export: only rows modified at or after sinceDate.
    // Each auditable table exposes an `updatedAt` / `created_at` column; we export
    // only those rows via COPY … TO STDOUT and collect them into a single NDJSON file.
    const tables = [
      { name: 'medical_records',         tsCol: '"updatedAt"' },
      { name: 'medical_record_versions', tsCol: '"createdAt"' },
      { name: 'medical_history',         tsCol: '"eventDate"' },
      { name: 'medical_attachments',     tsCol: '"createdAt"' },
      { name: 'medical_record_consents', tsCol: '"createdAt"' },
      { name: 'audit_logs',              tsCol: '"createdAt"' },
      { name: 'access_grants',           tsCol: '"updatedAt"' },
    ];

    const sinceDateIso = sinceDate.toISOString();
    const queries = tables
      .map(
        (t) =>
          `\\copy (SELECT row_to_json(t) FROM (SELECT * FROM ${t.name} WHERE ${t.tsCol} >= '${sinceDateIso}') t) TO STDOUT`,
      )
      .join('\n');

    await spawnAsync(
      'psql',
      [
        '-h', dbHost,
        '-p', dbPort,
        '-U', dbUser,
        '-d', dbName,
        '-o', `${outputPath}.pgdump`,
        '-c', queries,
      ],
      {
        env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD },
        logger: this.logger,
      },
    );
  }

  private async encryptBackup(inputPath: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Backup encryption key not configured');
    }

    const outputPath = `${inputPath}.enc`;
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const input = await fs.readFile(`${inputPath}.pgdump`);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Store IV and auth tag with encrypted data
    const output = Buffer.concat([iv, authTag, encrypted]);
    await fs.writeFile(outputPath, output);

    // Remove unencrypted file
    await fs.unlink(`${inputPath}.pgdump`);

    return outputPath;
  }

  private async compressBackup(inputPath: string): Promise<string> {
    const outputPath = `${inputPath}.gz`;
    await spawnAsync('gzip', ['-9', inputPath], { logger: this.logger });
    return outputPath;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  private async cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const oldBackups = await this.backupLogRepository.find({
      where: {
        startedAt: { $lt: cutoffDate } as any,
        status: BackupStatus.COMPLETED,
      },
    });

    for (const backup of oldBackups) {
      try {
        await fs.unlink(backup.backupPath);
        await this.backupLogRepository.remove(backup);
        this.logger.log(`Deleted old backup: ${backup.backupPath}`);
      } catch (error) {
        this.logger.error(`Failed to delete backup ${backup.id}: ${error.message}`);
      }
    }
  }

  async getBackupHistory(limit: number = 50): Promise<BackupLog[]> {
    return this.backupLogRepository.find({
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  async getBackupById(id: string): Promise<BackupLog> {
    return this.backupLogRepository.findOne({ where: { id } });
  }
}
