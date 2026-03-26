import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReconciliationRuns1772950000000 implements MigrationInterface {
  name = 'CreateReconciliationRuns1772950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "reconciliation_run_status_enum" AS ENUM ('running', 'completed', 'failed');
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reconciliation_runs" (
        "id"               UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "status"           "reconciliation_run_status_enum" NOT NULL DEFAULT 'running',
        "started_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "completed_at"     TIMESTAMPTZ NULL,
        "records_checked"  INTEGER     NOT NULL DEFAULT 0,
        "confirmed"        INTEGER     NOT NULL DEFAULT 0,
        "failed"           INTEGER     NOT NULL DEFAULT 0,
        "missing"          INTEGER     NOT NULL DEFAULT 0,
        "errors"           INTEGER     NOT NULL DEFAULT 0,
        CONSTRAINT "PK_reconciliation_runs" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reconciliation_runs_started_at"
        ON "reconciliation_runs" ("started_at" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reconciliation_runs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "reconciliation_run_status_enum"`);
  }
}
