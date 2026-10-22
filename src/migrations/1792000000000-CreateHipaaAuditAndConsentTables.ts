import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backing tables for HipaaComplianceService.
 *
 * The service previously held its audit trail in a process-local array and its
 * consents in a Map, so both were lost on restart and never shared between
 * replicas. These give them somewhere to live.
 */
export class CreateHipaaAuditAndConsentTables1792000000000 implements MigrationInterface {
  name = 'CreateHipaaAuditAndConsentTables1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hipaa_audit_logs" (
        "id"            UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "resourceType"  VARCHAR(100)  NOT NULL,
        "resourceId"    VARCHAR(255)  NOT NULL,
        "action"        VARCHAR(100)  NOT NULL,
        "userId"        VARCHAR(255)  NOT NULL,
        "timestamp"     TIMESTAMP     NOT NULL,
        "ipAddress"     VARCHAR(45),
        "userAgent"     TEXT,
        "createdAt"     TIMESTAMP     NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_hipaa_audit_logs" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hipaa_audit_logs_resource"
        ON "hipaa_audit_logs" ("resourceType", "resourceId", "timestamp");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hipaa_audit_logs_user"
        ON "hipaa_audit_logs" ("userId", "timestamp");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hipaa_audit_logs_timestamp"
        ON "hipaa_audit_logs" ("timestamp");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_consents" (
        "id"             UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "patientId"      VARCHAR(255)  NOT NULL,
        "consentType"    VARCHAR(100)  NOT NULL,
        "consentGiven"   BOOLEAN       NOT NULL,
        "consentDate"    TIMESTAMP     NOT NULL,
        "expirationDate" TIMESTAMP,
        "createdAt"      TIMESTAMP     NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_patient_consents" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_patient_consents_lookup"
        ON "patient_consents" ("patientId", "consentType", "consentDate");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_patient_consents_patient"
        ON "patient_consents" ("patientId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_consents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hipaa_audit_logs"`);
  }
}
