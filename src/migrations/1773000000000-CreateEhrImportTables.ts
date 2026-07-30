import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEhrImportTables1773000000000 implements MigrationInterface {
  name = 'CreateEhrImportTables1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "import_format_enum" AS ENUM ('hl7', 'ccd', 'csv');
      CREATE TYPE "import_job_status_enum" AS ENUM ('queued', 'processing', 'completed', 'failed');
    `);

    await queryRunner.query(`
      CREATE TABLE "import_jobs" (
        "id"               UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "importBatchId"    VARCHAR      NOT NULL,
        "format"           "import_format_enum"     NOT NULL,
        "status"           "import_job_status_enum" NOT NULL DEFAULT 'queued',
        "total"            INTEGER      NOT NULL DEFAULT 0,
        "processed"        INTEGER      NOT NULL DEFAULT 0,
        "succeeded"        INTEGER      NOT NULL DEFAULT 0,
        "failed"           INTEGER      NOT NULL DEFAULT 0,
        "dryRun"           BOOLEAN      NOT NULL DEFAULT false,
        "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_import_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_import_jobs_batch" UNIQUE ("importBatchId")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "import_errors" (
        "id"           UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "jobId"        UUID        NOT NULL,
        "rowIndex"     INTEGER     NOT NULL,
        "sourceRow"    TEXT        NOT NULL,
        "errorMessage" TEXT        NOT NULL,
        "stack"        TEXT,
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_import_errors" PRIMARY KEY ("id")
      );
      CREATE INDEX "IDX_import_errors_jobId" ON "import_errors" ("jobId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "import_errors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "import_jobs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "import_job_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "import_format_enum"`);
  }
}
