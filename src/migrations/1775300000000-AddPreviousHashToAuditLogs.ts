import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `previousHash` to `audit_logs` to form a tamper-evident hash chain.
 * Each row stores the SHA-256 of the previous row's `integrityHash`, so any
 * insertion, deletion, or modification of a historical row breaks the chain
 * and is detectable by a sequential scan.
 */
export class AddPreviousHashToAuditLogs1775300000000 implements MigrationInterface {
  name = 'AddPreviousHashToAuditLogs1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS "previousHash" varchar(128) NULL;
    `);

    // Index to support efficient chain-verification queries (walk by createdAt order)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
      ON audit_logs ("createdAt" ASC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_created_at`);
    await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS "previousHash"`);
  }
}
