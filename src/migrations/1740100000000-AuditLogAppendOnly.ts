import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds:
 *  1. `stellarTxHash` column to audit_logs (optional Stellar tamper-evidence hash).
 *  2. Append-only constraint: a PostgreSQL BEFORE UPDATE/DELETE trigger that raises
 *     an exception, enforcing immutability at the database level.
 */
export class AuditLogAppendOnly1740100000000 implements MigrationInterface {
  name = 'AuditLogAppendOnly1740100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add stellarTxHash column if it does not already exist
    await queryRunner.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS "stellarTxHash" varchar(255) NULL;
    `);

    // 2. Create the protection function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_logs_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs rows are append-only. UPDATE and DELETE are not allowed.';
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 3. Attach BEFORE UPDATE trigger
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
      CREATE TRIGGER trg_audit_logs_no_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
    `);

    // 4. Attach BEFORE DELETE trigger
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
      CREATE TRIGGER trg_audit_logs_no_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_logs_immutable`);
    await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS "stellarTxHash"`);
  }
}
