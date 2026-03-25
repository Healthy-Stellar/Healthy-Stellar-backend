import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnalyticsIndexes1741200000000 implements MigrationInterface {
  name = 'AddAnalyticsIndexes1741200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Index on medical_records(createdAt) for activity queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_medical_records_createdAt_analytics" 
      ON "medical_records" ("createdAt");
    `);

    // Index on access_grants(createdAt) for activity queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_access_grants_createdAt_analytics" 
      ON "access_grants" ("createdAt");
    `);

    // Composite index on access_grants(granteeId, status) for top providers query
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_access_grants_granteeId_status" 
      ON "access_grants" ("granteeId", "status");
    `);

    // Index on stellar_transactions(createdAt) for overview query optimization
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stellar_transactions_createdAt" 
      ON "stellar_transactions" ("createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_medical_records_createdAt_analytics";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_access_grants_createdAt_analytics";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_access_grants_granteeId_status";');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_stellar_transactions_createdAt";');
  }
}
