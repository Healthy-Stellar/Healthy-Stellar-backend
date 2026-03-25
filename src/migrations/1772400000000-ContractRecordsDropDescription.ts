import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CONTRACT PHASE — Zero-Downtime Migration Example
 *
 * Scenario: rename `records.description` → `records.summary` (Phase 2)
 *
 * Prerequisites before running this migration:
 *   1. The expand migration (1772300000000) has been deployed and run
 *   2. ALL application instances have been updated to write to `summary`
 *      and no longer read from `description`
 *   3. The backfill is complete: SELECT COUNT(*) FROM records WHERE summary IS NULL = 0
 *
 * This migration:
 *   - Performs a pre-flight safety check (aborts if any summary IS NULL)
 *   - Makes `description` nullable (if it wasn't already) — belt-and-suspenders
 *   - Drops the `description` column
 *
 * Safe to run while the API is live because:
 *   - The application no longer references `description`
 *   - DROP COLUMN in PostgreSQL 11+ takes a brief ACCESS EXCLUSIVE lock
 *     but only for metadata update, not a full table rewrite
 */
export class ContractRecordsDropDescription1772400000000 implements MigrationInterface {
  name = 'ContractRecordsDropDescription1772400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Pre-flight safety check ───────────────────────────────────────────────
    // Abort if any row still has summary = NULL but description != NULL.
    // This means the backfill is incomplete or app code still skips summary.
    const [{ count }] = await queryRunner.query(`
      SELECT COUNT(*) AS count
      FROM   "records"
      WHERE  "summary" IS NULL
        AND  "description" IS NOT NULL
    `);

    if (parseInt(count, 10) > 0) {
      throw new Error(
        `Contract migration aborted: ${count} rows still have summary=NULL. ` +
          'Complete the backfill before running the contract phase. ' +
          'Run: UPDATE records SET summary = description WHERE summary IS NULL;',
      );
    }

    // ── Step 1: Make description nullable (idempotent safety step) ────────────
    // If description was NOT NULL, this prevents a constraint violation during
    // the window between expand and contract. Already nullable = no-op.
    await queryRunner.query(`
      ALTER TABLE "records"
      ALTER COLUMN "description" DROP NOT NULL;
    `);

    // ── Step 2: Drop the old column ───────────────────────────────────────────
    // At this point no application code reads or writes description.
    await queryRunner.query(`
      ALTER TABLE "records"
      DROP COLUMN IF EXISTS "description";
    `);
  }

  /**
   * ROLLBACK: restore the description column and re-backfill from summary.
   *
   * Note: if application code has already been rolled back to a version that
   * writes to description, this rollback is sufficient. If app code is still
   * on the new version (writes only to summary), you must also roll back the
   * application deployment.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore description as nullable (we cannot know the original NOT NULL
    // constraint without inspecting history, so we restore as nullable — safe).
    await queryRunner.query(`
      ALTER TABLE "records"
      ADD COLUMN IF NOT EXISTS "description" TEXT NULL;
    `);

    // Re-backfill description from summary so old app code sees data
    await queryRunner.query(`
      UPDATE "records"
      SET    "description" = "summary"
      WHERE  "description" IS NULL
        AND  "summary"      IS NOT NULL;
    `);
  }
}
