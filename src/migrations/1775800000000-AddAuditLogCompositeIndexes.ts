import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogCompositeIndexes1775800000000 implements MigrationInterface {
  name = 'AddAuditLogCompositeIndexes1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // (user_id, created_at DESC) for user activity reports
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_audit_logs_userId_createdAt"
      ON "audit_logs" ("userId", "createdAt" DESC);
    `);

    // (patient_id_hash, action, created_at DESC) for patient-centric audit queries
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_audit_logs_patientIdHash_action_createdAt"
      ON "audit_logs" ("patientIdHash", "action", "createdAt" DESC);
    `);

    // (severity, created_at DESC) for security event dashboards
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_audit_logs_severity_createdAt"
      ON "audit_logs" ("severity", "createdAt" DESC);
    `);

    // (action, created_at DESC) for HIPAA audit report generation
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_audit_logs_action_createdAt"
      ON "audit_logs" ("action", "createdAt" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_audit_logs_userId_createdAt"`);
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_audit_logs_patientIdHash_action_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_audit_logs_severity_createdAt"`,
    );
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_audit_logs_action_createdAt"`);
  }
}
