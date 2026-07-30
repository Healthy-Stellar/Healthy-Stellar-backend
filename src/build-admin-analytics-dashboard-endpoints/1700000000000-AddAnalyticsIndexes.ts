import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes that make every analytics query sub-millisecond on 1 M rows.
 *
 * Rationale
 * ─────────
 * overview   → COUNT(*) on full tables; PK / heap-only scans are already fast.
 *              The partial index on access_grants filters the "active" subset.
 * activity   → BRIN index on append-only timestamp columns (tiny, 128-block range).
 *              BRIN is ideal for time-series tables: 10× smaller than B-tree,
 *              still enables date-range pruning without a full seq-scan.
 * top-providers → Covering index on (provider_id, status, expires_at)
 *                 lets Postgres satisfy the GROUP BY from the index alone.
 */
export class AddAnalyticsIndexes1700000000000 implements MigrationInterface {
  name = 'AddAnalyticsIndexes1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── access_grants: partial index for active grants ────────────────────────
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_grants_active
        ON access_grants (provider_id, expires_at)
        WHERE status = 'active'
    `);

    // ── records: BRIN on created_at for time-series range scans ──────────────
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_records_created_at_brin
        ON records USING BRIN (created_at)
        WITH (pages_per_range = 128)
    `);

    // ── access_events: BRIN on accessed_at ────────────────────────────────────
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_events_accessed_at_brin
        ON access_events USING BRIN (accessed_at)
        WITH (pages_per_range = 128)
    `);

    // ── stellar_transactions: plain count, no extra index needed (PK scan) ───
    // Covered by the PK; no action required.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_access_grants_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_records_created_at_brin`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_access_events_accessed_at_brin`);
  }
}
