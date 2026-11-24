import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { redactConnectionStrings } from './redact';

const execFileAsync = promisify(execFile);

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  durationMs: number;
  sizeBytes?: number;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Trigger a pg_dump backup before running migrations.
   * Controlled by MIGRATION_BACKUP_ENABLED env var (default: true in production).
   */
  async triggerPreMigrationBackup(label: string): Promise<BackupResult> {
    const enabled = this.isBackupEnabled();

    if (!enabled) {
      return {
        success: true,
        durationMs: 0,
        skipped: true,
        skipReason: 'MIGRATION_BACKUP_ENABLED=false',
      };
    }

    const startMs = Date.now();
    const backupDir = process.env.MIGRATION_BACKUP_DIR ?? '/tmp/db-backups';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pre-migration_${label}_${timestamp}.dump`;
    const backupPath = path.join(backupDir, filename);

    this.logger.log(`Starting pre-migration backup → ${backupPath}`);

    try {
      // Ensure backup directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // No shell, no credentials in argv. A non-zero exit code rejects the promise.
      await execFileAsync(
        'pg_dump',
        [
          '--format=custom',
          '--compress=6',
          `--file=${backupPath}`,
          '--no-owner',
          '--no-acl',
        ],
        {
          env: { ...process.env, ...this.buildPgEnv() },
          timeout: parseInt(process.env.MIGRATION_BACKUP_TIMEOUT_MS ?? '120000', 10),
        },
      );

      const durationMs = Date.now() - startMs;
      const stats = fs.statSync(backupPath);

      this.logger.log(
        `Backup complete: ${backupPath} (${stats.size} bytes, ${durationMs}ms)`,
      );

      return {
        success: true,
        backupPath,
        durationMs,
        sizeBytes: stats.size,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startMs;
      const message = redactConnectionStrings(
        err instanceof Error ? err.message : String(err),
      );
      this.logger.error(`Pre-migration backup failed: ${message}`);

      const blockOnFailure =
        process.env.MIGRATION_BACKUP_BLOCK_ON_FAILURE !== 'false';

      if (blockOnFailure) {
        return {
          success: false,
          durationMs,
          error: message,
        };
      }

      this.logger.warn('Backup failed but MIGRATION_BACKUP_BLOCK_ON_FAILURE=false — continuing.');
      return {
        success: true,
        durationMs,
        error: message,
        skipped: true,
        skipReason: 'backup-failed-non-blocking',
      };
    }
  }

  /** Connection params go in PG* env vars so they never appear in `ps` output. */
  private buildPgEnv(): Record<string, string> {
    if (process.env.DATABASE_URL) {
      const url = new URL(process.env.DATABASE_URL);
      const env: Record<string, string> = {
        PGHOST: url.hostname,
        PGPORT: url.port || '5432',
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
      };
      // shortcut: only sslmode is forwarded from DATABASE_URL query params; add others (sslrootcert, ...) when needed
      const sslmode = url.searchParams.get('sslmode');
      if (sslmode) env.PGSSLMODE = sslmode;
      return env;
    }

    const options = this.dataSource.options as Record<string, unknown>;
    return {
      PGHOST: String(options.host ?? 'localhost'),
      PGPORT: String(options.port ?? 5432),
      PGUSER: String(options.username ?? 'postgres'),
      PGPASSWORD: String(options.password ?? ''),
      PGDATABASE: String(options.database ?? 'postgres'),
    };
  }

  private isBackupEnabled(): boolean {
    const env = process.env.MIGRATION_BACKUP_ENABLED;
    if (env !== undefined) return env === 'true';
    // Default: enabled in production
    return process.env.NODE_ENV === 'production';
  }
}
