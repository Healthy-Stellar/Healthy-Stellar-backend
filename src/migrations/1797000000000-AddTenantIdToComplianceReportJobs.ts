import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add tenantId to compliance_report_jobs so reads and downloads are scoped to the
 * caller's tenant. Nullable: existing rows become platform-wide and are visible to
 * SUPER_ADMIN only, which fails closed for historical reports.
 */
export class AddTenantIdToComplianceReportJobs1797000000000 implements MigrationInterface {
  name = 'AddTenantIdToComplianceReportJobs1797000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('compliance_report_jobs'))) return;

    await queryRunner.query(`
      ALTER TABLE "compliance_report_jobs"
        ADD COLUMN IF NOT EXISTS "tenantId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_compliance_report_jobs_tenantId"
        ON "compliance_report_jobs" ("tenantId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('compliance_report_jobs'))) return;

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_compliance_report_jobs_tenantId"`);
    await queryRunner.query(`
      ALTER TABLE "compliance_report_jobs"
        DROP COLUMN IF EXISTS "tenantId"
    `);
  }
}
