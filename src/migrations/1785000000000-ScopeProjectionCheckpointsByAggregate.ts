import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Event-store versions are scoped per-aggregate, but `projection_checkpoints`
 * tracked a single global row per projector. Once the global checkpoint
 * advanced past a low version from one aggregate, events with version <=
 * that from every other aggregate were silently skipped as "already
 * processed". This migration re-scopes the checkpoint to (projector_name,
 * aggregate_id) so each aggregate's progress is tracked independently.
 *
 * Also aligns the table's column names with the `ProjectionCheckpoint`
 * entity, which already declared snake_case column names that this table
 * never actually had.
 */
export class ScopeProjectionCheckpointsByAggregate1785000000000 implements MigrationInterface {
  name = 'ScopeProjectionCheckpointsByAggregate1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" RENAME COLUMN "projectorName" TO "projector_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" RENAME COLUMN "lastProcessedVersion" TO "last_processed_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" RENAME COLUMN "updatedAt" TO "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" ADD COLUMN IF NOT EXISTS "event_count" BIGINT NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" ADD COLUMN "id" UUID NOT NULL DEFAULT uuid_generate_v4()`,
    );
    // Existing rows tracked global progress; fold that history under a sentinel
    // aggregate so replay/idempotency for those projectors is unaffected until
    // fresh per-aggregate rows are written going forward.
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" ADD COLUMN "aggregate_id" VARCHAR(100) NOT NULL DEFAULT '__legacy_global__'`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" ALTER COLUMN "aggregate_id" DROP DEFAULT`,
    );

    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" DROP CONSTRAINT "PK_projection_checkpoints"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" ADD CONSTRAINT "PK_projection_checkpoints" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "projection_checkpoints"
      ADD CONSTRAINT "UQ_projection_checkpoints_projector_aggregate" UNIQUE ("projector_name", "aggregate_id")
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_projection_checkpoints_projector" ON "projection_checkpoints" ("projector_name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_projection_checkpoints_projector"`);
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" DROP CONSTRAINT "UQ_projection_checkpoints_projector_aggregate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" DROP CONSTRAINT "PK_projection_checkpoints"`,
    );
    await queryRunner.query(`ALTER TABLE "projection_checkpoints" DROP COLUMN "aggregate_id"`);
    await queryRunner.query(`ALTER TABLE "projection_checkpoints" DROP COLUMN "id"`);
    await queryRunner.query(`ALTER TABLE "projection_checkpoints" DROP COLUMN "event_count"`);
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" ADD CONSTRAINT "PK_projection_checkpoints" PRIMARY KEY ("projector_name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" RENAME COLUMN "projector_name" TO "projectorName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" RENAME COLUMN "last_processed_version" TO "lastProcessedVersion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_checkpoints" RENAME COLUMN "updated_at" TO "updatedAt"`,
    );
  }
}
