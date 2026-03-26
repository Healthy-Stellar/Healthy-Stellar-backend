import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

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

      const { connectionString, pgDumpArgs } = this.buildPgDumpArgs(backupPath);

      const { stdout, stderr } = await execAsync(
        `pg_dump ${pgDumpArgs}`,
        {
          env: {
            ...process.env,
            PGPASSWORD: this.extractPassword(connectionString),
          },
          timeout: parseInt(process.env.MIGRATION_BACKUP_TIMEOUT_MS ?? '120000', 10),
        },
      );

      if (stderr && !stderr.includes('warning')) {
        throw new Error(`pg_dump stderr: ${stderr}`);
      }

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
      const message = err instanceof Error ? err.message : String(err);
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

  private buildPgDumpArgs(outputPath: string): {
    connectionString: string;
    pgDumpArgs: string;
  } {
    const connectionString =
      process.env.DATABASE_URL ??
      this.buildConnectionStringFromParts();

    // Use custom format for efficient, restoreable backups
    const pgDumpArgs = [
      `"${connectionString}"`,
      '--format=custom',
      '--compress=6',
      `--file="${outputPath}"`,
      '--no-owner',
      '--no-acl',
      '--verbose',
    ].join(' ');

    return { connectionString, pgDumpArgs };
  }

  private buildConnectionStringFromParts(): string {
    const options = this.dataSource.options as Record<string, unknown>;
    const host = options.host ?? 'localhost';
    const port = options.port ?? 5432;
    const database = options.database ?? 'postgres';
    const username = options.username ?? 'postgres';
    const password = options.password ?? '';
    return `postgresql://${username}:${password}@${host}:${port}/${database}`;
  }

  private extractPassword(connectionString: string): string {
    try {
      const url = new URL(connectionString);
      return url.password ?? '';
    } catch {
      return process.env.DB_PASSWORD ?? '';
    }
  }

  private isBackupEnabled(): boolean {
    const env = process.env.MIGRATION_BACKUP_ENABLED;
    if (env !== undefined) return env === 'true';
    // Default: enabled in production
    return process.env.NODE_ENV === 'production';
  }
}
