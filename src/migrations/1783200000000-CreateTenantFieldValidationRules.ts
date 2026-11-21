import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantFieldValidationRules1783200000000 implements MigrationInterface {
  name = 'CreateTenantFieldValidationRules1783200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('tenant_field_validation_rules'))) {
      await queryRunner.query(`
        CREATE TABLE "tenant_field_validation_rules" (
          "id"            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "tenantId"      VARCHAR NOT NULL,
          "fieldName"     VARCHAR NOT NULL,
          "type"          VARCHAR NOT NULL DEFAULT 'STRING',
          "pattern"       VARCHAR,
          "required"      BOOLEAN NOT NULL DEFAULT false,
          "errorMessage"  VARCHAR,
          "isActive"      BOOLEAN NOT NULL DEFAULT true,
          "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT "UQ_tenant_field_validation_rules_tenant_field" UNIQUE ("tenantId", "fieldName")
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "IDX_tenant_field_validation_rules_tenant"
          ON "tenant_field_validation_rules" ("tenantId")
      `);
    }

    if (
      (await queryRunner.hasTable('patients')) &&
      !(await queryRunner.hasColumn('patients', 'customFields'))
    ) {
      await queryRunner.query(`
        ALTER TABLE "patients" ADD COLUMN "customFields" JSON
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('patients')) &&
      (await queryRunner.hasColumn('patients', 'customFields'))
    ) {
      await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "customFields"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_field_validation_rules"`);
  }
}
