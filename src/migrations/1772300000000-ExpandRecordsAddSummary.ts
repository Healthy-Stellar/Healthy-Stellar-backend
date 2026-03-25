import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EXPAND PHASE — Zero-Downtime Migration Example
 *
 * Scenario: rename `records.description` → `records.summary`
 *
 * This is Phase 1 of the expand/contract pattern.
 * The old `description` column is left intact so the currently-deployed
 * application continues to work without any changes.
 *
 * Safe to run while the API is live:
 *   - Adding a nullable column takes no table lock in PostgreSQL 11+
 *   - The backfill runs in batches to avoid long-running transactions
 *   - The index is created with CONCURRENTLY (no table lock)
 *
 * Deploy order:
 *   1. Run this migration (npm run migration:run)
 *   2. Deploy new app code that writes to BOTH description AND summary
 *   3. Once all instances are updated, proceed to the contract migration
 */
export class ExpandRecordsAddSummary1772300000000 implements MigrationInterface {
  name = 'ExpandRecordsAddSummary1772300000000';

  // Rows processed per batch during backfill — keep small to avoid lock contention
  private readonly BATCH_SIZE = 1000;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Step 1: Add the new column as nullable ────────────────────────────────
    // NULL default means no table rewrite, no lock, instant on any table size.
    await queryRunner.query(`
      ALTER TABLE "records"
      ADD COLUMN IF NOT EXISTS "summary" TEXT NULL;
    `);

    // ── Step 2: Backfill existing rows in batches ─────────────────────────────
    // Never UPDATE all rows in one transaction — it holds a lock for too long
    // and bloats WAL. Process in small batches instead.
    let offset = 0;
    let rowsUpdated: number;

    do {
      const result = await queryRunner.query(`
        UPDATE "records"
        SET    "summary" = "description"
        WHERE  "id" IN (
          SELECT "id"
          FROM   "records"
          WHERE  "summary" IS NULL
            AND  "description" IS NOT NULL
          ORDER  BY "id"
          LIMIT  ${this.BATCH_SIZE}
        )
      `);

      // queryRunner.query returns the raw pg result; affected rows are in [1]
      rowsUpdated = Array.isArray(result) ? result[1] : (result?.rowCount ?? 0);
      offset += rowsUpdated;

      // Small pause between batches to reduce I/O pressure on production
      if (rowsUpdated > 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } while (rowsUpdated === this.BATCH_SIZE);

    // ── Step 3: Add index CONCURRENTLY ────────────────────────────────────────
    // CONCURRENTLY never takes an ACCESS EXCLUSIVE lock — safe on live tables.
    // Must be run OUTSIDE a transaction block; queryRunner handles this.
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_records_summary"
      ON "records" ("summary");
    `);
  }

  /**
   * ROLLBACK: drop the new column and its index.
   * Dropping a nullable column that was just added is safe and instant.
   * No data loss — the original `description` column is untouched.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX CONCURRENTLY IF EXISTS "IDX_records_summary";
    `);

    await queryRunner.query(`
      ALTER TABLE "records"
      DROP COLUMN IF EXISTS "summary";
    `);
  }
}
