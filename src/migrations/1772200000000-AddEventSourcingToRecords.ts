import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Event Sourcing Migration for Records
 *
 * Creates:
 *   1. record_events  — immutable append-only event log (JSONB payload)
 *   2. record_snapshots — materialised state snapshots (rebuilt every 100 events)
 *
 * Also migrates all existing records into the event store as RECORD_MIGRATED events.
 */
export class AddEventSourcingToRecords1772200000000 implements MigrationInterface {
  name = 'AddEventSourcingToRecords1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. record_events table ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "record_events" (
        "id"              UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "record_id"       UUID        NOT NULL,
        "event_type"      VARCHAR(100) NOT NULL,
        "payload"         JSONB       NOT NULL,
        "sequence_number" INTEGER     NOT NULL,
        "timestamp"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "caused_by"       UUID        NULL,
        CONSTRAINT "PK_record_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_record_events_record_seq" UNIQUE ("record_id", "sequence_number")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_record_events_record_id"
        ON "record_events" ("record_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_record_events_record_seq"
        ON "record_events" ("record_id", "sequence_number");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_record_events_record_ts"
        ON "record_events" ("record_id", "timestamp");
    `);

    // Append-only protection: prevent UPDATE and DELETE on record_events
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION record_events_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'record_events rows are append-only. UPDATE and DELETE are not allowed.';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_record_events_no_update ON "record_events";
      CREATE TRIGGER trg_record_events_no_update
      BEFORE UPDATE ON "record_events"
      FOR EACH ROW EXECUTE FUNCTION record_events_immutable();
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_record_events_no_delete ON "record_events";
      CREATE TRIGGER trg_record_events_no_delete
      BEFORE DELETE ON "record_events"
      FOR EACH ROW EXECUTE FUNCTION record_events_immutable();
    `);

    // ── 2. record_snapshots table ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "record_snapshots" (
        "id"              UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "record_id"       UUID        NOT NULL,
        "sequence_number" INTEGER     NOT NULL,
        "state"           JSONB       NOT NULL,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_record_snapshots" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_record_snapshots_record_id"
        ON "record_snapshots" ("record_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_record_snapshots_record_seq"
        ON "record_snapshots" ("record_id", "sequence_number");
    `);

    // ── 3. Migrate existing records into the event store ──────────────────────
    // Each existing record becomes a RECORD_MIGRATED event at sequence_number = 1
    await queryRunner.query(`
      INSERT INTO "record_events" (
        "id",
        "record_id",
        "event_type",
        "payload",
        "sequence_number",
        "timestamp",
        "caused_by"
      )
      SELECT
        uuid_generate_v4(),
        r."id",
        'RECORD_MIGRATED',
        jsonb_build_object(
          'patientId',      r."patientId",
          'cid',            r."cid",
          'stellarTxHash',  r."stellarTxHash",
          'recordType',     r."recordType",
          'description',    r."description",
          'createdAt',      r."createdAt"
        ),
        1,
        r."createdAt",
        NULL
      FROM "records" r
      ON CONFLICT ("record_id", "sequence_number") DO NOTHING;
    `);

    // ── 4. Build initial snapshots for all migrated records ───────────────────
    // Snapshot at sequence_number = 1 (the migration event itself)
    await queryRunner.query(`
      INSERT INTO "record_snapshots" (
        "id",
        "record_id",
        "sequence_number",
        "state",
        "created_at"
      )
      SELECT
        uuid_generate_v4(),
        e."record_id",
        1,
        jsonb_build_object(
          'id',             e."record_id",
          'patientId',      e."payload"->>'patientId',
          'cid',            e."payload"->>'cid',
          'stellarTxHash',  e."payload"->>'stellarTxHash',
          'recordType',     e."payload"->>'recordType',
          'description',    e."payload"->>'description',
          'createdAt',      e."payload"->>'createdAt',
          'updatedAt',      e."timestamp",
          'sequenceNumber', 1,
          'deleted',        false
        ),
        NOW()
      FROM "record_events" e
      WHERE e."event_type" = 'RECORD_MIGRATED'
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers first (they reference the function)
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_record_events_no_delete ON "record_events"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_record_events_no_update ON "record_events"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS record_events_immutable`);

    await queryRunner.query(`DROP TABLE IF EXISTS "record_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "record_events"`);
  }
}
