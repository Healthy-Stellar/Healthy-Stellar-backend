import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expand migration: add isDeleted + deletedOnChainAt to the records table.
 * Safe to run with zero downtime — both columns are nullable/defaulted.
 */
export class AddSoftDeleteToRecords1772500000000 implements MigrationInterface {
  name = 'AddSoftDeleteToRecords1772500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "records"
        ADD COLUMN IF NOT EXISTS "isDeleted" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "deletedOnChainAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_records_isDeleted"
        ON "records" ("isDeleted")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_records_isDeleted"`);
    await queryRunner.query(`
      ALTER TABLE "records"
        DROP COLUMN IF EXISTS "isDeleted",
        DROP COLUMN IF EXISTS "deletedOnChainAt"
    `);
  }
}
