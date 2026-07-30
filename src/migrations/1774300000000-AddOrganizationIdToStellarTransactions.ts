import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationIdToStellarTransactions1774300000000 implements MigrationInterface {
  name = 'AddOrganizationIdToStellarTransactions1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stellar_transactions" ADD COLUMN IF NOT EXISTS "organizationId" uuid REFERENCES tenants(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stellar_transactions_organizationId" ON "stellar_transactions" ("organizationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stellar_transactions_organizationId"`);
    await queryRunner.query(`ALTER TABLE "stellar_transactions" DROP COLUMN IF EXISTS "organizationId"`);
  }
}
