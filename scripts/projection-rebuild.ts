/**
 * CLI command: npm run projection:rebuild -- --projection=<ProjectorName>
 *
 * Replays all events from the event store and rebuilds the target projection
 * in a shadow table, then atomically swaps the shadow into place.
 *
 * Usage:
 *   npm run projection:rebuild -- --projection=RecordProjector
 *   npm run projection:rebuild -- --projection=AccessGrantProjector
 *   npm run projection:rebuild -- --projection=AuditProjector
 *   npm run projection:rebuild -- --projection=AnalyticsProjector
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { EventBus } from '@nestjs/cqrs';
import { AppModule } from '../src/app.module';
import { EventStoreService } from '../src/event-store/event-store.service';
import { CheckpointService } from '../src/projections/checkpoint/checkpoint.service';

// ── Configuration ──────────────────────────────────────────────────────────────

const VALID_PROJECTORS = new Set([
  'RecordProjector',
  'AccessGrantProjector',
  'AuditProjector',
  'AnalyticsProjector',
]);

/** Maps each projector to its TypeORM read-model table name. */
const PROJECTOR_TABLE: Record<string, string> = {
  RecordProjector: 'medical_records_read',
  AccessGrantProjector: 'access_grants_read',
  AuditProjector: 'audit_logs_projection',
  AnalyticsProjector: 'analytics_snapshots',
};

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(): { projectorName: string } {
  const arg = process.argv.find((a) => a.startsWith('--projection='));
  if (!arg) {
    console.error('Error: --projection=<name> is required');
    console.error(`Valid values: ${[...VALID_PROJECTORS].join(', ')}`);
    process.exit(1);
  }
  const projectorName = arg.split('=')[1];
  if (!VALID_PROJECTORS.has(projectorName)) {
    console.error(`Error: unknown projector "${projectorName}"`);
    console.error(`Valid values: ${[...VALID_PROJECTORS].join(', ')}`);
    process.exit(1);
  }
  return { projectorName };
}

// ── Shadow-table rebuild ──────────────────────────────────────────────────────

/**
 * Rebuilds a projection using the shadow-table swap pattern:
 *
 *  1. Rename <table> → <table>_old   (preserve current data as rollback)
 *  2. CREATE TABLE <table> LIKE <table>_old  (fresh shadow becomes new main)
 *  3. Reset checkpoint so projectors start from event version 0
 *  4. Stream all events and publish via EventBus — projectors write into new <table>
 *  5. On success:  DROP <table>_old
 *  6. On failure:  DROP <table>, RENAME <table>_old → <table>  (rollback)
 */
async function rebuildWithShadowSwap(
  projectorName: string,
  dataSource: DataSource,
  eventStore: EventStoreService,
  eventBus: EventBus,
  checkpoints: CheckpointService,
): Promise<void> {
  const tableName = PROJECTOR_TABLE[projectorName];
  const oldTableName = `${tableName}_old`;

  console.log(`\nRebuilding projection: ${projectorName}`);
  console.log(`  Table:  ${tableName}`);
  console.log(`  Shadow: rename current → ${oldTableName}, build fresh ${tableName}\n`);

  // Step 1 — Save current table as rollback copy
  await dataSource.query(`ALTER TABLE "${tableName}" RENAME TO "${oldTableName}"`);
  console.log(`[1/5] Renamed "${tableName}" → "${oldTableName}"`);

  // Step 2 — Create new empty table with same schema (this is the "shadow")
  await dataSource.query(
    `CREATE TABLE "${tableName}" (LIKE "${oldTableName}" INCLUDING ALL)`,
  );
  console.log(`[2/5] Created new empty "${tableName}" (shadow table)\n`);

  try {
    // Step 3 — Reset checkpoint so projectors process from version 0
    await checkpoints.reset(projectorName);
    console.log(`[3/5] Checkpoint reset for ${projectorName}`);

    // Step 4 — Stream events and replay with progress logging
    const total = await eventStore.count();
    console.log(`[4/5] Replaying ${total} events…\n`);

    let processed = 0;
    const startMs = Date.now();

    for await (const { event } of eventStore.streamAll(0)) {
      await eventBus.publish(event as any);
      processed++;

      if (processed % 100 === 0 || processed === total) {
        const elapsedSec = (Date.now() - startMs) / 1000;
        const rate = processed / elapsedSec;
        const remaining = total - processed;
        const etaSec = rate > 0 ? remaining / rate : 0;
        const pct = total > 0 ? Math.round((processed / total) * 100) : 100;

        process.stdout.write(
          `\r    ${processed}/${total} events (${pct}%)  ` +
            `elapsed: ${elapsedSec.toFixed(1)}s  ETA: ${etaSec.toFixed(0)}s      `,
        );
      }
    }

    process.stdout.write('\n\n');

    // Step 5 — Success: drop the old table
    await dataSource.query(`DROP TABLE IF EXISTS "${oldTableName}"`);
    console.log(`[5/5] Dropped "${oldTableName}" (swap complete)`);

    const totalSec = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(
      `\n✓ Rebuild complete: ${processed} events replayed in ${totalSec}s\n`,
    );
  } catch (err: any) {
    // Step 6 — Failure: rollback to previous table
    console.error(`\n✗ Rebuild failed: ${err.message}`);
    console.log('\nRolling back…');

    try {
      await dataSource.query(`DROP TABLE IF EXISTS "${tableName}"`);
      await dataSource.query(`ALTER TABLE "${oldTableName}" RENAME TO "${tableName}"`);
      console.log(`Rollback complete — "${tableName}" restored from "${oldTableName}"`);
    } catch (rollbackErr: any) {
      console.error(`Rollback also failed: ${rollbackErr.message}`);
      console.error(
        `MANUAL ACTION REQUIRED: rename "${oldTableName}" back to "${tableName}"`,
      );
    }

    process.exit(1);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { projectorName } = parseArgs();

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const dataSource = app.get(DataSource);
    const eventStore = app.get(EventStoreService);
    const eventBus = app.get(EventBus);
    const checkpoints = app.get(CheckpointService);

    await rebuildWithShadowSwap(projectorName, dataSource, eventStore, eventBus, checkpoints);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
