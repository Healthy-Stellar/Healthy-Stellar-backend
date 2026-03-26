import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

export interface SafetyCheckResult {
  passed: boolean;
  blockers: SafetyBlocker[];
  warnings: string[];
}

export interface SafetyBlocker {
  type: 'bullmq' | 'active_transaction' | 'production_guard';
  message: string;
  detail?: Record<string, unknown>;
}

// Active transaction row from pg_stat_activity
interface PgStatActivity {
  pid: string;
  query: string;
  state: string;
  duration_seconds: string;
}

@Injectable()
export class SafetyChecksService {
  private readonly logger = new Logger(SafetyChecksService.name);

  /** Seconds threshold for flagging long-running transactions */
  private static readonly ACTIVE_TX_THRESHOLD_SEC = 30;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Run all safety checks and return a consolidated result.
   * Pass the list of queue names to check for pending BullMQ jobs.
   */
  async runAll(
    affectedTables: string[],
    queueNames: string[] = [],
  ): Promise<SafetyCheckResult> {
    const blockers: SafetyBlocker[] = [];
    const warnings: string[] = [];

    // 1. Production guard
    const prodCheck = this.checkProductionGuard();
    if (!prodCheck.passed) blockers.push(prodCheck.blocker!);
    if (prodCheck.warning) warnings.push(prodCheck.warning);

    // 2. BullMQ pending jobs
    if (queueNames.length > 0 && affectedTables.length > 0) {
      const bullResult = await this.checkBullMQJobs(queueNames, affectedTables);
      blockers.push(...bullResult.blockers);
      warnings.push(...bullResult.warnings);
    }

    // 3. Active long-running transactions
    const txResult = await this.checkActiveTransactions();
    blockers.push(...txResult.blockers);
    warnings.push(...txResult.warnings);

    return {
      passed: blockers.length === 0,
      blockers,
      warnings,
    };
  }

  // ---------------------------------------------------------------------------
  // Individual checks
  // ---------------------------------------------------------------------------

  checkProductionGuard(): {
    passed: boolean;
    blocker?: SafetyBlocker;
    warning?: string;
  } {
    const isProduction = process.env.NODE_ENV === 'production';
    const confirmed =
      process.env.CONFIRM_PRODUCTION_MIGRATION === 'true';

    if (!isProduction) {
      return { passed: true };
    }

    if (!confirmed) {
      return {
        passed: false,
        blocker: {
          type: 'production_guard',
          message:
            'Running in production environment. Set CONFIRM_PRODUCTION_MIGRATION=true to proceed.',
          detail: { NODE_ENV: process.env.NODE_ENV },
        },
      };
    }

    return {
      passed: true,
      warning:
        '⚠  CONFIRM_PRODUCTION_MIGRATION=true detected — running against production database.',
    };
  }

  async checkBullMQJobs(
    queueNames: string[],
    affectedTables: string[],
  ): Promise<{ blockers: SafetyBlocker[]; warnings: string[] }> {
    const blockers: SafetyBlocker[] = [];
    const warnings: string[] = [];

    for (const queueName of queueNames) {
      try {
        const queue = new Queue(queueName, {
          connection: this.buildRedisConnection(),
        });

        const [waiting, active, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getDelayed(),
        ]);

        const allJobs = [...waiting, ...active, ...delayed];

        for (const job of allJobs) {
          const jobData = JSON.stringify(job.data ?? {}).toLowerCase();
          const referencedTable = affectedTables.find((t) =>
            jobData.includes(t.toLowerCase()),
          );

          if (referencedTable) {
            blockers.push({
              type: 'bullmq',
              message: `Queue "${queueName}" has ${allJobs.length} pending/active job(s) that may reference table "${referencedTable}".`,
              detail: {
                queue: queueName,
                jobCount: allJobs.length,
                affectedTable: referencedTable,
                waitingCount: waiting.length,
                activeCount: active.length,
                delayedCount: delayed.length,
              },
            });
            break; // one blocker per queue is enough
          }
        }

        await queue.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        warnings.push(
          `Could not inspect BullMQ queue "${queueName}": ${message}`,
        );
      }
    }

    return { blockers, warnings };
  }

  async checkActiveTransactions(): Promise<{
    blockers: SafetyBlocker[];
    warnings: string[];
  }> {
    const blockers: SafetyBlocker[] = [];
    const warnings: string[] = [];

    try {
      const rows: PgStatActivity[] = await this.dataSource.query(`
        SELECT
          pid::text,
          query,
          state,
          EXTRACT(EPOCH FROM (now() - xact_start))::numeric(10,2) AS duration_seconds
        FROM pg_stat_activity
        WHERE
          state IN ('idle in transaction', 'active')
          AND xact_start IS NOT NULL
          AND pid <> pg_backend_pid()
          AND EXTRACT(EPOCH FROM (now() - xact_start)) > $1
        ORDER BY duration_seconds DESC
      `, [SafetyChecksService.ACTIVE_TX_THRESHOLD_SEC]);

      if (rows.length > 0) {
        const worst = rows[0];
        blockers.push({
          type: 'active_transaction',
          message: `${rows.length} active transaction(s) older than ${SafetyChecksService.ACTIVE_TX_THRESHOLD_SEC}s detected. Longest: ${worst.duration_seconds}s (PID ${worst.pid}).`,
          detail: {
            transactionCount: rows.length,
            longestDurationSeconds: worst.duration_seconds,
            longestPid: worst.pid,
            longestQuery: worst.query?.substring(0, 200),
          },
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      warnings.push(`Could not inspect pg_stat_activity: ${message}`);
    }

    return { blockers, warnings };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildRedisConnection(): { host: string; port: number; password?: string } {
    return {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      ...(process.env.REDIS_PASSWORD
        ? { password: process.env.REDIS_PASSWORD }
        : {}),
    };
  }
}
