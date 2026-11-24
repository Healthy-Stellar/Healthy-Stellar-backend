import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add tenantId to the infection-control tables so every query and threshold
 * evaluation can be scoped to the caller's tenant. Nullable so existing rows
 * remain valid; legacy rows without a tenant are not visible to any tenant.
 */
const TABLES = [
  'infection_cases',
  'isolation_precautions',
  'antibiotic_resistance',
  'infection_control_policies',
  'outbreak_incidents',
  'hand_hygiene_audits',
  'outbreak_thresholds',
  'outbreak_alerts',
];

export class AddTenantIdToInfectionControl1797000000000 implements MigrationInterface {
  name = 'AddTenantIdToInfectionControl1797000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      if (!(await queryRunner.hasTable(table))) continue;

      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD COLUMN IF NOT EXISTS "tenantId" character varying
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_${table}_tenantId"
          ON "${table}" ("tenantId")
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      if (!(await queryRunner.hasTable(table))) continue;

      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${table}_tenantId"`);
      await queryRunner.query(`
        ALTER TABLE "${table}"
          DROP COLUMN IF EXISTS "tenantId"
      `);
    }
  }
}
