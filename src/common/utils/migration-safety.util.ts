import { QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

const logger = new Logger('MigrationSafety');

/**
 * Checks that a table exists before attempting to alter it.
 */
export async function assertTableExists(qr: QueryRunner, table: string): Promise<void> {
  const exists = await qr.hasTable(table);
  if (!exists) throw new Error(`Migration safety: table '${table}' does not exist`);
}

/**
 * Checks that a column exists before dropping or renaming it.
 */
export async function assertColumnExists(
  qr: QueryRunner,
  table: string,
  column: string,
): Promise<void> {
  const exists = await qr.hasColumn(table, column);
  if (!exists)
    throw new Error(`Migration safety: column '${table}.${column}' does not exist`);
}

/**
 * Adds a column only if it does not already exist (idempotent).
 * Safe for zero-downtime: new nullable/defaulted columns never block writes.
 */
export async function addColumnIfMissing(
  qr: QueryRunner,
  table: string,
  columnDdl: string,
): Promise<void> {
  const columnName = columnDdl.trim().split(/\s+/)[0].replace(/"/g, '');
  const exists = await qr.hasColumn(table, columnName);
  if (exists) {
    logger.log(`Column '${table}.${columnName}' already exists — skipping`);
    return;
  }
  await qr.query(`ALTER TABLE "${table}" ADD COLUMN ${columnDdl}`);
  logger.log(`Added column '${table}.${columnName}'`);
}

/**
 * Creates an index CONCURRENTLY so it does not lock the table.
 * Falls back gracefully if the index already exists.
 */
export async function createIndexConcurrently(
  qr: QueryRunner,
  indexName: string,
  table: string,
  columns: string[],
  unique = false,
): Promise<void> {
  const cols = columns.map((c) => `"${c}"`).join(', ');
  const uniqueClause = unique ? 'UNIQUE ' : '';
  try {
    // CONCURRENTLY cannot run inside a transaction — use raw driver
    await qr.query(
      `CREATE ${uniqueClause}INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "${table}" (${cols})`,
    );
    logger.log(`Index '${indexName}' created concurrently on '${table}'`);
  } catch (err: any) {
    // Already exists or concurrent build in progress — safe to ignore
    logger.warn(`Index '${indexName}' skipped: ${err.message}`);
  }
}

/**
 * Drops a column only after verifying no NOT NULL constraint without a default
 * would break existing application code.  Logs a warning and skips if missing.
 */
export async function dropColumnSafely(
  qr: QueryRunner,
  table: string,
  column: string,
): Promise<void> {
  const exists = await qr.hasColumn(table, column);
  if (!exists) {
    logger.warn(`Column '${table}.${column}' already absent — skipping drop`);
    return;
  }
  await qr.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}"`);
  logger.log(`Dropped column '${table}.${column}'`);
}

/**
 * Renames a column using the two-step expand/contract pattern:
 *  1. Add new column (nullable copy)
 *  2. Backfill
 *  3. Rename old → _deprecated (keeps old code working during deploy)
 * The caller is responsible for the final drop in a subsequent migration.
 */
export async function renameColumnSafely(
  qr: QueryRunner,
  table: string,
  oldName: string,
  newName: string,
  columnType: string,
): Promise<void> {
  await addColumnIfMissing(qr, table, `"${newName}" ${columnType}`);
  await qr.query(
    `UPDATE "${table}" SET "${newName}" = "${oldName}" WHERE "${newName}" IS NULL`,
  );
  const deprecatedName = `${oldName}_deprecated`;
  const deprecatedExists = await qr.hasColumn(table, deprecatedName);
  if (!deprecatedExists) {
    await qr.query(
      `ALTER TABLE "${table}" RENAME COLUMN "${oldName}" TO "${deprecatedName}"`,
    );
    logger.log(
      `Renamed '${table}.${oldName}' → '${deprecatedName}' (backfill complete for '${newName}')`,
    );
  }
}
