import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a globally monotonic `global_sequence` column to `event_store`.
 *
 * `version` on this table is scoped per-aggregate (see the column comment
 * on EventEntity), so it is not safe to use for cursoring over the *entire*
 * event stream: once a pagination cursor built from `version` passes another
 * aggregate's version number, that aggregate's remaining events are silently
 * skipped (or, if the cursor resets lower, re-emitted) during full
 * projection rebuilds. `EventStoreService#streamAll` was doing exactly that.
 *
 * `global_sequence` is backed by a dedicated sequence, assigned at insert
 * time, and is strictly increasing across the whole table regardless of
 * aggregate — the correct key for full-stream pagination.
 */
export class AddGlobalSequenceToEventStore1785500000000 implements MigrationInterface {
  name = 'AddGlobalSequenceToEventStore1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS "event_store_global_sequence_seq";
    `);

    await queryRunner.query(`
      ALTER TABLE "event_store" ADD COLUMN IF NOT EXISTS "global_sequence" BIGINT;
    `);

    // Backfill existing rows in (approximate) original insertion order.
    // event_store is append-only (UPDATE/DELETE are trigger-blocked), so
    // recorded_at + id is a reliable proxy for the order rows were written.
    await queryRunner.query(`
      UPDATE "event_store" e
      SET "global_sequence" = ordered.rn
      FROM (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "recorded_at" ASC, "id" ASC) AS rn
        FROM "event_store"
      ) ordered
      WHERE e."id" = ordered."id"
        AND e."global_sequence" IS NULL;
    `);

    // Point the sequence past whatever we just backfilled, then wire it up
    // as the column default so every future insert gets the next value.
    await queryRunner.query(`
      SELECT setval(
        'event_store_global_sequence_seq',
        COALESCE((SELECT MAX("global_sequence") FROM "event_store"), 0) + 1,
        false
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "event_store"
      ALTER COLUMN "global_sequence" SET DEFAULT nextval('event_store_global_sequence_seq');
    `);

    await queryRunner.query(`
      ALTER SEQUENCE "event_store_global_sequence_seq" OWNED BY "event_store"."global_sequence";
    `);

    await queryRunner.query(`
      ALTER TABLE "event_store" ALTER COLUMN "global_sequence" SET NOT NULL;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_event_store_global_sequence"
        ON "event_store" ("global_sequence");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_event_store_global_sequence"`);
    await queryRunner.query(
      `ALTER TABLE "event_store" DROP COLUMN IF EXISTS "global_sequence"`,
    );
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "event_store_global_sequence_seq"`);
  }
}
