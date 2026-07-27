import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDlqJobsTable1775600000000 implements MigrationInterface {
  name = 'CreateDlqJobsTable1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "dlq_jobs_status_enum" AS ENUM ('failed', 'replayed', 'discarded');
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dlq_jobs" (
        "id"             UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "job_id"         VARCHAR(256) NOT NULL,
        "queue_name"     VARCHAR(128) NOT NULL,
        "job_name"       VARCHAR(256) NOT NULL,
        "data"           JSONB        NOT NULL,
        "opts"           JSONB        NOT NULL DEFAULT '{}',
        "failed_reason"  TEXT,
        "stack_trace"    TEXT,
        "attempts_made"  INTEGER      NOT NULL DEFAULT 0,
        "status"         "dlq_jobs_status_enum" NOT NULL DEFAULT 'failed',
        "replay_count"   INTEGER      NOT NULL DEFAULT 0,
        "replayed_by"    VARCHAR(256),
        "failed_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_dlq_jobs" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dlq_jobs_queue_name"
        ON "dlq_jobs" ("queue_name");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dlq_jobs_status"
        ON "dlq_jobs" ("status");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dlq_jobs_job_id"
        ON "dlq_jobs" ("job_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "dlq_jobs";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "dlq_jobs_status_enum";`);
  }
}
