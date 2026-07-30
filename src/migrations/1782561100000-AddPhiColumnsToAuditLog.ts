import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds PHI-context columns to the tamper-evident `audit_log` table so that
 * every access event can be filtered by patient, tenant, and actor role.
 */
export class AddPhiColumnsToAuditLog1782561100000 implements MigrationInterface {
  name = 'AddPhiColumnsToAuditLog1782561100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE audit_log
        ADD COLUMN IF NOT EXISTS patient_id  VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS tenant_id   VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS actor_role  VARCHAR(100) NULL;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_patient_id ON audit_log (patient_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id  ON audit_log (tenant_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_log_patient_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_log_tenant_id`);
    await queryRunner.query(`
      ALTER TABLE audit_log
        DROP COLUMN IF EXISTS patient_id,
        DROP COLUMN IF EXISTS tenant_id,
        DROP COLUMN IF EXISTS actor_role;
    `);
  }
}
