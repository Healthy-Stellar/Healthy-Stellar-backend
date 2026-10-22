import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds performance indexes to support PHI audit log queries:
 *  1. (resourceType, createdAt DESC) on audit_logs — for PHI resource type filtering
 *  2. (resourceType, timestamp DESC) on audit_log — for sensitive audit log resource type queries
 *  3. (resourceId, timestamp DESC) on audit_log — for resource-specific audit trail lookups
 */
export class PhiAuditLogEnhancements1783000000000 implements MigrationInterface {
  name = 'PhiAuditLogEnhancements1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Index 1: audit_logs (resourceType, createdAt) — PHI resource type queries on the general log
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_audit_logs_resourceType_createdAt"
      ON "audit_logs" ("resourceType", "createdAt" DESC);
    `);

    // Index 2: audit_log (resourceType, timestamp) — PHI resource type queries on the sensitive log
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_audit_log_resourceType_timestamp"
      ON "audit_log" ("resourceType", "timestamp" DESC);
    `);

    // Index 3: audit_log (resourceId, timestamp) — resource-specific audit trail
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_audit_log_resourceId_timestamp"
      ON "audit_log" ("resourceId", "timestamp" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_audit_log_resourceId_timestamp"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_audit_log_resourceType_timestamp"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_audit_logs_resourceType_createdAt"`,
    );
  }
}
