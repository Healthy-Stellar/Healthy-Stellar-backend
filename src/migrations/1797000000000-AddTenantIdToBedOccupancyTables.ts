import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expand migration: add indexed tenant_id to wards, rooms, and beds so all
 * bed-occupancy operations are scoped to the caller's tenant. Nullable so
 * existing rows remain valid without failing NOT NULL on non-empty tables;
 * legacy rows with NULL tenant_id are excluded from tenant-scoped queries.
 */
export class AddTenantIdToBedOccupancyTables1797000000000 implements MigrationInterface {
  name = 'AddTenantIdToBedOccupancyTables1797000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['wards', 'rooms', 'beds']) {
      if (!(await queryRunner.hasTable(table))) continue;

      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD COLUMN IF NOT EXISTS "tenant_id" character varying
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_${table}_tenant_id"
          ON "${table}" ("tenant_id")
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['beds', 'rooms', 'wards']) {
      if (!(await queryRunner.hasTable(table))) continue;

      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${table}_tenant_id"`);
      await queryRunner.query(`
        ALTER TABLE "${table}"
          DROP COLUMN IF EXISTS "tenant_id"
      `);
    }
  }
}
