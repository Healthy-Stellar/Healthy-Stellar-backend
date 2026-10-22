import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserImportJobsTable1776400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "user_import_jobs_status_enum" AS ENUM (
        'pending', 'processing', 'completed', 'failed'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_import_jobs" (
        "id"            UUID                              NOT NULL DEFAULT gen_random_uuid(),
        "status"        "user_import_jobs_status_enum"   NOT NULL DEFAULT 'pending',
        "totalRows"     INTEGER                           NOT NULL,
        "processedRows" INTEGER                           NOT NULL DEFAULT 0,
        "successRows"   INTEGER                           NOT NULL DEFAULT 0,
        "failedRows"    INTEGER                           NOT NULL DEFAULT 0,
        "initiatedBy"   UUID,
        "rowErrors"     JSONB,
        "errorMessage"  TEXT,
        "createdAt"     TIMESTAMP                         NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP                         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_import_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_import_jobs_initiatedBy" ON "user_import_jobs" ("initiatedBy")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_import_jobs_initiatedBy"`);
    await queryRunner.query(`DROP TABLE "user_import_jobs"`);
    await queryRunner.query(`DROP TYPE "user_import_jobs_status_enum"`);
  }
}
