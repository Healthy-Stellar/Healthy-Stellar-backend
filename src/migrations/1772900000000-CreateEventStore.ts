import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the event_store and event_store_snapshots tables.
 *
 * The event_store table is append-only: UPDATE and DELETE are blocked
 * by PostgreSQL triggers so the event log can never be tampered with.
 */
export class CreateEventStore1772900000000 implements MigrationInterface {
  name = 'CreateEventStore1772900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. event_store ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_store" (
        "id"             UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "aggregate_id"   UUID         NOT NULL,
        "aggregate_type" VARCHAR(100) NOT NULL,
        "event_type"     VARCHAR(100) NOT NULL,
        "payload"        JSONB        NOT NULL,
        "metadata"       JSONB        NOT NULL DEFAULT '{}',
        "version"        INTEGER      NOT NULL,
        "occurred_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "recorded_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_event_store" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_store_aggregate_version" UNIQUE ("aggregate_id", "version")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_store_aggregate_id"
        ON "event_store" ("aggregate_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_store_aggregate_version"
        ON "event_store" ("aggregate_id", "version");
    `);

    // ── 2. Append-only protection ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION event_store_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'event_store rows are append-only — UPDATE and DELETE are not permitted.';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_event_store_no_update ON "event_store";
      CREATE TRIGGER trg_event_store_no_update
      BEFORE UPDATE ON "event_store"
      FOR EACH ROW EXECUTE FUNCTION event_store_immutable();
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_event_store_no_delete ON "event_store";
      CREATE TRIGGER trg_event_store_no_delete
      BEFORE DELETE ON "event_store"
      FOR EACH ROW EXECUTE FUNCTION event_store_immutable();
    `);

    // ── 3. event_store_snapshots ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_store_snapshots" (
        "id"             UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "aggregate_id"   UUID         NOT NULL,
        "aggregate_type" VARCHAR(100) NOT NULL,
        "version"        INTEGER      NOT NULL,
        "state"          JSONB        NOT NULL,
        "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_event_store_snapshots" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_store_snapshots_aggregate_id"
        ON "event_store_snapshots" ("aggregate_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_store_snapshots_aggregate_version"
        ON "event_store_snapshots" ("aggregate_id", "version");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_event_store_no_delete ON "event_store"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_event_store_no_update ON "event_store"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS event_store_immutable`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_store_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_store"`);
  }
}
