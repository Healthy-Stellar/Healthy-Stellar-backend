import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expand migration: add reconciliationAttempts to the records table.
 * Safe to run with zero downtime — the column is added with a DEFAULT so
 * existing rows are satisfied immediately.
 */
export class AddReconciliationAttemptsToRecords1791000000000
  implements MigrationInterface
{
  name = 'AddReconciliationAttemptsToRecords1791000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "records"
        ADD COLUMN IF NOT EXISTS "reconciliationAttempts" integer NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "records"
        DROP COLUMN IF EXISTS "reconciliationAttempts"
    `);
  }
}
