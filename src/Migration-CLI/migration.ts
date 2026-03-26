#!/usr/bin/env ts-node
/**
 * Migration CLI Entry Point
 * ─────────────────────────
 * Bootstraps a minimal NestJS application context and delegates to
 * MigrationCliService.  All commands are registered via Commander.js.
 *
 * Usage (via npm scripts):
 *   npm run migration:status
 *   npm run migration:dry-run
 *   npm run migration:run
 *   npm run migration:revert
 *   npm run migration:revert -- --steps=3
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Command } from 'commander';
import { AppModule } from '../src/app.module';
import { MigrationCliService } from '../src/database/migration-cli/migration-cli.service';
import { DryRunReport } from '../src/database/migration-cli/dry-run.service';
import { SafetyCheckResult } from '../src/database/migration-cli/safety-checks.service';

const logger = new Logger('MigrationCLI');

// ─── Formatting helpers ───────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

const c = (color: keyof typeof COLORS, text: string) =>
  `${COLORS[color]}${text}${COLORS.reset}`;

function printSectionHeader(title: string) {
  const line = '─'.repeat(60);
  console.log(`\n${c('cyan', line)}`);
  console.log(`${c('bold', `  ${title}`)}`);
  console.log(`${c('cyan', line)}\n`);
}

function printSafetyCheckResult(result: SafetyCheckResult) {
  if (result.passed) {
    console.log(c('green', '  ✓ All safety checks passed'));
  } else {
    console.log(c('red', '  ✗ Safety checks FAILED:'));
    for (const blocker of result.blockers) {
      console.log(`    ${c('red', '●')} [${blocker.type}] ${blocker.message}`);
      if (blocker.detail) {
        console.log(
          c('gray', `      ${JSON.stringify(blocker.detail, null, 2).replace(/\n/g, '\n      ')}`),
        );
      }
    }
  }

  if (result.warnings.length > 0) {
    console.log();
    for (const w of result.warnings) {
      console.log(`  ${c('yellow', '⚠')} ${w}`);
    }
  }
}

function printDryRunReports(reports: DryRunReport[]) {
  if (reports.length === 0) {
    console.log(c('gray', '  No pending migrations.'));
    return;
  }

  for (const report of reports) {
    console.log(`\n${c('bold', `Migration: ${report.migrationName}`)}`);
    console.log(
      c('gray', `  Tables affected: ${report.tablesAffected.join(', ') || 'unknown'}`),
    );
    console.log(
      c(
        'gray',
        `  Estimated lock time: ${(report.estimatedTotalLockMs / 1000).toFixed(1)}s`,
      ),
    );

    if (report.totalIndexOperations.length > 0) {
      console.log(`\n  ${c('magenta', 'Index Operations:')}`);
      for (const op of report.totalIndexOperations) {
        const concurrent = op.concurrent ? c('green', ' [CONCURRENT]') : c('yellow', ' [BLOCKING]');
        console.log(
          `    ${op.type} INDEX ${c('cyan', op.indexName)} ON ${op.tableName}${concurrent}`,
        );
      }
    }

    if (report.warnings.length > 0) {
      console.log(`\n  ${c('yellow', 'Warnings:')}`);
      for (const w of report.warnings) {
        console.log(`    ⚠  ${w}`);
      }
    }

    console.log(`\n  ${c('bold', 'SQL Statements:')}`);
    for (let i = 0; i < report.statements.length; i++) {
      const stmt = report.statements[i];
      const rowInfo =
        stmt.estimatedRowsAffected !== undefined
          ? c('gray', ` -- ~${stmt.estimatedRowsAffected.toLocaleString()} rows`)
          : '';
      const lockInfo = stmt.lockLevel
        ? c('yellow', ` [LOCK: ${stmt.lockLevel}]`)
        : '';
      console.log(
        `\n  ${c('gray', `[${i + 1}]`)} ${c('cyan', stmt.operationType)}${lockInfo}${rowInfo}`,
      );
      console.log(`  ${c('gray', stmt.sql)}`);
    }
    console.log();
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function bootstrap() {
  // Suppress NestJS startup noise in CLI context
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const migrationService = app.get(MigrationCliService);
  return { app, migrationService };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('migration-cli')
  .description('Healthy-Stellar Database Migration CLI')
  .version('1.0.0');

// ── migration:status ─────────────────────────────────────────────────────────

program
  .command('status')
  .description('List all migrations with their current status')
  .action(async () => {
    const { app, migrationService } = await bootstrap();
    printSectionHeader('Migration Status');

    try {
      const entries = await migrationService.getStatus();

      if (entries.length === 0) {
        console.log(c('gray', '  No migrations found.'));
      } else {
        const maxNameLen = Math.max(...entries.map((e) => e.name.length), 10);

        for (const entry of entries) {
          const statusColor: Record<string, keyof typeof COLORS> = {
            executed: 'green',
            pending: 'yellow',
            failed: 'red',
          };
          const col = statusColor[entry.status] ?? 'gray';
          const statusTag = c(col, entry.status.padEnd(8).toUpperCase());
          const name = entry.name.padEnd(maxNameLen + 2);
          const meta = entry.executedAt
            ? c('gray', `executed ${entry.executedAt.toISOString()}${entry.durationMs ? ` (${entry.durationMs}ms)` : ''}`)
            : '';
          console.log(`  ${statusTag} ${name} ${meta}`);
        }
      }

      const pending = entries.filter((e) => e.status === 'pending').length;
      const executed = entries.filter((e) => e.status === 'executed').length;
      const failed = entries.filter((e) => e.status === 'failed').length;

      console.log(`\n  ${c('gray', `Total: ${entries.length} | Executed: ${executed} | Pending: ${pending} | Failed: ${failed}`)}`);
    } finally {
      await app.close();
    }
  });

// ── migration:dry-run ─────────────────────────────────────────────────────────

program
  .command('dry-run')
  .description('Show SQL that would be executed without applying changes')
  .option('--skip-safety-checks', 'Skip pre-flight safety checks')
  .option('--queues <names>', 'Comma-separated BullMQ queue names to inspect', '')
  .action(async (opts) => {
    const { app, migrationService } = await bootstrap();
    printSectionHeader('Migration Dry-Run');

    try {
      const queueNames = opts.queues
        ? (opts.queues as string).split(',').map((q: string) => q.trim()).filter(Boolean)
        : [];

      const { reports, safetyCheckResult, warnings } = await migrationService.dryRun({
        queueNames,
        skipSafetyChecks: opts.skipSafetyChecks as boolean,
      });

      console.log(c('bold', 'Safety Checks:'));
      printSafetyCheckResult(safetyCheckResult);

      printSectionHeader('Dry-Run SQL Preview');
      printDryRunReports(reports);

      if (warnings.length > 0) {
        console.log(c('yellow', '\nGeneral Warnings:'));
        warnings.forEach((w) => console.log(`  ⚠  ${w}`));
      }

      console.log(
        c(
          'green',
          '\n✓ Dry-run complete — no changes were applied to the database.',
        ),
      );
    } finally {
      await app.close();
    }
  });

// ── migration:run ─────────────────────────────────────────────────────────────

program
  .command('run')
  .description('Run pending migrations with pre-migration backup and safety checks')
  .option('--skip-safety-checks', 'Skip pre-flight safety checks')
  .option('--skip-backup', 'Skip pre-migration backup')
  .option('--queues <names>', 'Comma-separated BullMQ queue names to inspect', '')
  .action(async (opts) => {
    const { app, migrationService } = await bootstrap();
    printSectionHeader('Running Migrations');

    try {
      const queueNames = opts.queues
        ? (opts.queues as string).split(',').map((q: string) => q.trim()).filter(Boolean)
        : [];

      const result = await migrationService.run({
        queueNames,
        skipSafetyChecks: opts.skipSafetyChecks as boolean,
        skipBackup: opts.skipBackup as boolean,
      });

      if (result.safetyCheckResult) {
        console.log(c('bold', 'Safety Checks:'));
        printSafetyCheckResult(result.safetyCheckResult);
        console.log();
      }

      if (result.backupResult) {
        const br = result.backupResult;
        if (br.skipped) {
          console.log(c('yellow', `  ⚠ Backup skipped: ${br.skipReason}`));
        } else if (br.success) {
          console.log(
            c('green', `  ✓ Backup created: ${br.backupPath} (${((br.sizeBytes ?? 0) / 1024 / 1024).toFixed(2)} MB, ${br.durationMs}ms)`),
          );
        } else {
          console.log(c('red', `  ✗ Backup FAILED: ${br.error}`));
        }
        console.log();
      }

      if (result.success) {
        if (result.migrationsRan.length === 0) {
          console.log(c('gray', '  No pending migrations to run.'));
        } else {
          for (const name of result.migrationsRan) {
            console.log(c('green', `  ✓ ${name}`));
          }
          console.log(
            `\n${c('green', `✓ ${result.migrationsRan.length} migration(s) applied in ${result.durationMs}ms`)}`,
          );
        }
      } else {
        console.log(c('red', '\n✗ Migration run FAILED:'));
        result.errors.forEach((e) => console.log(`  ${c('red', e)}`));
        process.exit(1);
      }
    } finally {
      await app.close();
    }
  });

// ── migration:revert ──────────────────────────────────────────────────────────

program
  .command('revert')
  .description('Revert the last N executed migrations')
  .option('--steps <n>', 'Number of migrations to revert', '1')
  .action(async (opts) => {
    const { app, migrationService } = await bootstrap();
    const steps = parseInt(opts.steps as string, 10);

    if (isNaN(steps) || steps < 1) {
      console.error(c('red', 'Error: --steps must be a positive integer'));
      process.exit(1);
    }

    printSectionHeader(`Reverting Last ${steps} Migration(s)`);

    try {
      const result = await migrationService.revert({ steps });

      if (result.migrationsReverted.length > 0) {
        for (const name of result.migrationsReverted) {
          console.log(c('magenta', `  ↩ ${name}`));
        }
      }

      if (result.success) {
        console.log(
          `\n${c('green', `✓ ${result.migrationsReverted.length} migration(s) reverted in ${result.durationMs}ms`)}`,
        );
      } else {
        console.log(c('red', '\n✗ Revert encountered errors:'));
        result.errors.forEach((e) => console.log(`  ${c('red', e)}`));
        process.exit(1);
      }
    } finally {
      await app.close();
    }
  });

// ─── Execute ─────────────────────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(c('red', `\nFatal error: ${message}`));
  logger.error(message, err instanceof Error ? err.stack : undefined);
  process.exit(1);
});
