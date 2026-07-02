import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAlertRulesTable1782561100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."alert_rules_operator_enum"
        AS ENUM('gt', 'gte', 'lt', 'lte', 'eq')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."alert_rules_priority_enum"
        AS ENUM('low', 'medium', 'high', 'critical')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "alert_rules" (
        "id"          uuid                              NOT NULL DEFAULT uuid_generate_v4(),
        "patientId"   uuid                              NOT NULL,
        "tenantId"    uuid,
        "metricName"  varchar(50)                       NOT NULL,
        "operator"    "public"."alert_rules_operator_enum" NOT NULL,
        "threshold"   numeric(10,4)                     NOT NULL,
        "priority"    "public"."alert_rules_priority_enum" NOT NULL DEFAULT 'high',
        "isActive"    boolean                           NOT NULL DEFAULT true,
        "name"        varchar(200)                      NOT NULL,
        "description" text,
        "createdBy"   uuid                              NOT NULL,
        "createdAt"   TIMESTAMP                         NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP                         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_alert_rules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_alert_rules_patientId_isActive"
        ON "alert_rules" ("patientId", "isActive")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_alert_rules_tenantId_isActive"
        ON "alert_rules" ("tenantId", "isActive")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_alert_rules_patientId"
        ON "alert_rules" ("patientId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_rules_patientId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_rules_tenantId_isActive"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alert_rules_patientId_isActive"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "alert_rules"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."alert_rules_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."alert_rules_operator_enum"`);
  }
}
