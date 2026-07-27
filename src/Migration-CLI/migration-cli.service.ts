import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, MigrationInterface } from 'typeorm';
import * as crypto from 'crypto';
import * as os from 'os';
import { MigrationHistory, MigrationStatus } from './entities/migration-history.entity';
import { SafetyChecksService, SafetyCheckResult } from './safety-checks.service';
import { DryRunService, DryRunReport } from './dry-run.service';
import { BackupService, BackupResult } from './backup.service';
import { SlackNotifierService } from './slack-notifier.service';

// ─── Result DTOs ────────────────────────────────────────────────────────────

export interface MigrationStatusEntry {
  name: string;
  status: 'pending' | 'executed' | 'failed';
  executedAt?: Date;
  durationMs?: number;
}

export interface RunResult {
  success: boolean;
  migrationsRan: string[];
  durationMs: number;
  backupResult?: BackupResult;
  safetyCheckResult?: SafetyCheckResult;
  errors: string[];
}

export interface RevertResult {
  success: boolean;
  migrationsReverted: string[];
  durationMs: number;
  errors: string[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class MigrationCliService {
  private readonly logger = new Logger(MigrationCliService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,

    @InjectRepository(MigrationHistory)
    private readonly historyRepo: Repository<MigrationHistory>,

    private readonly safetyChecks: SafetyChecksService,
    private readonly dryRunService: DryRunService,
    private readonly backupService: BackupService,
    private readonly slackNotifier: SlackNotifierService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all migrations with their current status.
   * Combines TypeORM's recorded executions with our migration_history table.
   */
  async getStatus(): Promise<MigrationStatusEntry[]> {
    // Pending = defined in code but not yet run
    const pending = await this.dataSource.showMigrations();

    // Executed = recorded in typeorm_migrations table
    const executedRows: Array<{ name: string; timestamp: string }> =
      await this.dataSource.query(
        `SELECT name, timestamp FROM typeorm_migrations ORDER BY timestamp ASC`,
      );

    // Our richer history
    const historyRows = await this.historyRepo.find({
      order: { executedAt: 'DESC' },
    });
    const historyByName = new Map(historyRows.map((h) => [h.migrationName, h]));

    const entries: MigrationStatusEntry[] = executedRows.map((row) => {
      const hist = historyByName.get(row.name);
      return {
        name: row.name,
        status: 'executed',
        executedAt: hist?.executedAt,
        durationMs: hist?.durationMs ?? undefined,
      };
    });

    // Add pending ones — TypeORM.showMigrations returns true if there ARE pending
    const allMigrationClasses = this.dataSource.migrations ?? [];
    for (const migClass of allMigrationClasses) {
      const instance = migClass as unknown as MigrationInterface;
      const name = instance.name ?? migClass.name;
      if (!entries.find((e) => e.name === name)) {
        const hist = historyByName.get(name);
        entries.push({
          name,
          status: hist?.status === MigrationStatus.FAILED ? 'failed' : 'pending',
          executedAt: hist?.executedAt,
          durationMs: hist?.durationMs ?? undefined,
        });
      }
    }

    return entries;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DRY RUN
  // ═══════════════════════════════════════════════════════════════════════════

  async dryRun(options: {
    queueNames?: string[];
    skipSafetyChecks?: boolean;
  } = {}): Promise<{
    reports: DryRunReport[];
    safetyCheckResult: SafetyCheckResult;
    warnings: string[];
  }> {
    const pendingMigrations = await this.getPendingMigrationInstances();

    if (pendingMigrations.length === 0) {
      this.logger.log('No pending migrations found for dry-run.');
      return {
        reports: [],
        safetyCheckResult: { passed: true, blockers: [], warnings: [] },
        warnings: ['No pending migrations.'],
      };
    }

    // Extract tables from migration names as a best-effort hint
    const allTables = this.extractTableHints(pendingMigrations);

    const safetyCheckResult = options.skipSafetyChecks
      ? { passed: true, blockers: [], warnings: [] }
      : await this.safetyChecks.runAll(allTables, options.queueNames ?? []);

    const reports = await this.dryRunService.executeDryRun(pendingMigrations);

    const warnings = [
      ...safetyCheckResult.warnings,
      ...reports.flatMap((r) => r.warnings),
    ];

    return { reports, safetyCheckResult, warnings };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN
  // ═══════════════════════════════════════════════════════════════════════════

  async run(options: {
    queueNames?: string[];
    skipSafetyChecks?: boolean;
    skipBackup?: boolean;
  } = {}): Promise<RunResult> {
    const startMs = Date.now();
    const executor = this.resolveExecutor();
    const environment = process.env.NODE_ENV ?? 'development';
    const errors: string[] = [];
    const migrationsRan: string[] = [];

    const pendingMigrations = await this.getPendingMigrationInstances();

    if (pendingMigrations.length === 0) {
      this.logger.log('No pending migrations to run.');
      return {
        success: true,
        migrationsRan: [],
        durationMs: 0,
        errors: [],
      };
    }

    const affectedTables = this.extractTableHints(pendingMigrations);
    const pendingNames = pendingMigrations.map((m) => m.name ?? m.constructor.name);

    // ── Safety Checks ───────────────────────────────────────────────────────
    let safetyCheckResult: SafetyCheckResult = { passed: true, blockers: [], warnings: [] };

    if (!options.skipSafetyChecks) {
      safetyCheckResult = await this.safetyChecks.runAll(
        affectedTables,
        options.queueNames ?? [],
      );

      if (!safetyCheckResult.passed) {
        const blockerMessages = safetyCheckResult.blockers.map((b) => b.message);
        this.logger.error('Safety checks FAILED. Blocking migration.');
        blockerMessages.forEach((m) => this.logger.error(`  ✗ ${m}`));

        await this.slackNotifier.notify({
          event: 'migration_failed',
          migrationNames: pendingNames,
          executor,
          environment,
          error: `Safety checks failed:\n${blockerMessages.join('\n')}`,
        });

        return {
          success: false,
          migrationsRan: [],
          durationMs: Date.now() - startMs,
          safetyCheckResult,
          errors: blockerMessages,
        };
      }
    }

    // ── Backup ──────────────────────────────────────────────────────────────
    let backupResult: BackupResult | undefined;

    if (!options.skipBackup) {
      backupResult = await this.backupService.triggerPreMigrationBackup(
        pendingNames[0].replace(/\W/g, '_').substring(0, 50),
      );

      if (!backupResult.success) {
        errors.push(`Backup failed: ${backupResult.error}`);
        await this.slackNotifier.notify({
          event: 'migration_failed',
          migrationNames: pendingNames,
          executor,
          environment,
          error: `Pre-migration backup failed: ${backupResult.error}`,
        });

        return {
          success: false,
          migrationsRan: [],
          durationMs: Date.now() - startMs,
          backupResult,
          safetyCheckResult,
          errors,
        };
      }
    }

    // ── Notify Start ────────────────────────────────────────────────────────
    await this.slackNotifier.notify({
      event: 'migration_started',
      migrationNames: pendingNames,
      executor,
      environment,
      backupPath: backupResult?.backupPath,
    });

    // ── Run Each Migration ──────────────────────────────────────────────────
    for (const migration of pendingMigrations) {
      const name = migration.name ?? migration.constructor.name;
      const historyEntry = this.historyRepo.create({
        migrationName: name,
        executedBy: executor,
        status: MigrationStatus.PENDING,
        checksum: this.computeChecksum(migration),
        dryRun: false,
      });
      await this.historyRepo.save(historyEntry);

      const migStart = Date.now();

      try {
        await this.dataSource.runMigrations({ transaction: 'each' });
        const durationMs = Date.now() - migStart;

        historyEntry.status = MigrationStatus.EXECUTED;
        historyEntry.durationMs = durationMs;
        await this.historyRepo.save(historyEntry);

        migrationsRan.push(name);
        this.logger.log(`✓ Migration executed: ${name} (${durationMs}ms)`);
      } catch (err: unknown) {
        const durationMs = Date.now() - migStart;
        const errorMsg = err instanceof Error ? err.message : String(err);

        historyEntry.status = MigrationStatus.FAILED;
        historyEntry.durationMs = durationMs;
        historyEntry.errorMessage = errorMsg;
        await this.historyRepo.save(historyEntry);

        errors.push(`Migration "${name}" failed: ${errorMsg}`);
        this.logger.error(`✗ Migration failed: ${name} — ${errorMsg}`);

        await this.slackNotifier.notify({
          event: 'migration_failed',
          migrationNames: [name],
          executor,
          environment,
          durationMs: Date.now() - startMs,
          error: errorMsg,
          backupPath: backupResult?.backupPath,
        });

        return {
          success: false,
          migrationsRan,
          durationMs: Date.now() - startMs,
          backupResult,
          safetyCheckResult,
          errors,
        };
      }
    }

    const totalDuration = Date.now() - startMs;

    await this.slackNotifier.notify({
      event: 'migration_success',
      migrationNames: migrationsRan,
      executor,
      environment,
      durationMs: totalDuration,
      backupPath: backupResult?.backupPath,
    });

    return {
      success: true,
      migrationsRan,
      durationMs: totalDuration,
      backupResult,
      safetyCheckResult,
      errors: [],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REVERT
  // ═══════════════════════════════════════════════════════════════════════════

  async revert(options: { steps?: number } = {}): Promise<RevertResult> {
    const startMs = Date.now();
    const executor = this.resolveExecutor();
    const environment = process.env.NODE_ENV ?? 'development';
    const steps = options.steps ?? 1;
    const migrationsReverted: string[] = [];
    const errors: string[] = [];

    this.logger.log(`Reverting last ${steps} migration(s)...`);

    for (let i = 0; i < steps; i++) {
      try {
        // Fetch the last executed migration from history
        const lastHistory = await this.historyRepo.findOne({
          where: { status: MigrationStatus.EXECUTED },
          order: { executedAt: 'DESC' },
        });

        if (!lastHistory) {
          this.logger.log('No more executed migrations to revert.');
          break;
        }

        await this.dataSource.undoLastMigration({ transaction: 'each' });

        lastHistory.status = MigrationStatus.REVERTED;
        lastHistory.revertedAt = new Date();
        lastHistory.revertedBy = executor;
        await this.historyRepo.save(lastHistory);

        migrationsReverted.push(lastHistory.migrationName);
        this.logger.log(`↩ Reverted: ${lastHistory.migrationName}`);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Revert step ${i + 1} failed: ${errorMsg}`);
        this.logger.error(`Revert failed at step ${i + 1}: ${errorMsg}`);
        break;
      }
    }

    const totalDuration = Date.now() - startMs;

    if (migrationsReverted.length > 0) {
      await this.slackNotifier.notify({
        event: 'migration_reverted',
        migrationNames: migrationsReverted,
        executor,
        environment,
        durationMs: totalDuration,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      });
    }

    return {
      success: errors.length === 0,
      migrationsReverted,
      durationMs: totalDuration,
      errors,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private async getPendingMigrationInstances(): Promise<MigrationInterface[]> {
    const hasPending = await this.dataSource.showMigrations();
    if (!hasPending) return [];

    // Get names already executed
    const executedRows: Array<{ name: string }> = await this.dataSource.query(
      `SELECT name FROM typeorm_migrations`,
    );
    const executedNames = new Set(executedRows.map((r) => r.name));

    return (this.dataSource.migrations ?? [])
      .map((M) => new (M as unknown as new () => MigrationInterface)())
      .filter((m) => {
        const name = m.name ?? m.constructor.name;
        return !executedNames.has(name);
      });
  }

  private extractTableHints(migrations: MigrationInterface[]): string[] {
    // Best-effort: extract table names from migration class names
    // e.g. "AddIndexToUsersTable" → ["users"]
    const tables: string[] = [];
    for (const m of migrations) {
      const name = m.name ?? m.constructor.name ?? '';
      const match = name.match(/(?:to|from|in|on)_?([A-Za-z]+?)(?:Table|_table)?$/i);
      if (match) {
        tables.push(match[1].toLowerCase());
      }
    }
    return [...new Set(tables)];
  }

  private computeChecksum(migration: MigrationInterface): string {
    const source = migration.up.toString() + (migration.down?.toString() ?? '');
    return crypto.createHash('sha256').update(source).digest('hex').substring(0, 16);
  }

  private resolveExecutor(): string {
    return (
      process.env.MIGRATION_EXECUTOR ??
      process.env.GITHUB_ACTOR ??
      process.env.USER ??
      os.userInfo().username ??
      'unknown'
    );
  }
}
