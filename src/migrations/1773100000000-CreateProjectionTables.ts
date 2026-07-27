import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectionTables1773100000000 implements MigrationInterface {
  name = 'CreateProjectionTables1773100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "projection_checkpoints" (
        "projectorName"          VARCHAR(100) NOT NULL,
        "lastProcessedVersion"   BIGINT       NOT NULL DEFAULT 0,
        "updatedAt"              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_projection_checkpoints" PRIMARY KEY ("projectorName")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "medical_records_read" (
        "id"           UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "aggregateId"  UUID         NOT NULL,
        "patientId"    UUID         NOT NULL,
        "recordType"   VARCHAR(100) NOT NULL,
        "cid"          VARCHAR      NULL,
        "uploadedBy"   VARCHAR      NULL,
        "amendedBy"    VARCHAR      NULL,
        "lastChanges"  JSONB        NULL,
        "deleted"      BOOLEAN      NOT NULL DEFAULT FALSE,
        "version"      INTEGER      NOT NULL DEFAULT 0,
        "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_medical_records_read" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_medical_records_read_aggregate" UNIQUE ("aggregateId")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_mrr_patient" ON "medical_records_read" ("patientId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_mrr_type"    ON "medical_records_read" ("recordType");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "access_grants_read" (
        "id"                UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "aggregateId"       UUID         NOT NULL,
        "patientId"         UUID         NOT NULL,
        "grantedTo"         UUID         NOT NULL,
        "grantedBy"         UUID         NOT NULL,
        "status"            VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE',
        "expiresAt"         TIMESTAMPTZ  NULL,
        "revokedFrom"       UUID         NULL,
        "revokedBy"         UUID         NULL,
        "revocationReason"  TEXT         NULL,
        "version"           INTEGER      NOT NULL DEFAULT 0,
        "updatedAt"         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_access_grants_read" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_access_grants_read_aggregate" UNIQUE ("aggregateId")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_agr_patient_status" ON "access_grants_read" ("patientId", "status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_agr_grantee_status" ON "access_grants_read" ("grantedTo", "status");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs_projection" (
        "id"            UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "aggregateId"   UUID         NOT NULL,
        "aggregateType" VARCHAR(100) NOT NULL,
        "eventType"     VARCHAR(100) NOT NULL,
        "payload"       JSONB        NOT NULL,
        "version"       INTEGER      NOT NULL,
        "occurredAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_audit_logs_projection" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_alp_aggregate"  ON "audit_logs_projection" ("aggregateId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_alp_event_type" ON "audit_logs_projection" ("eventType");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_alp_occurred"   ON "audit_logs_projection" ("occurredAt");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analytics_snapshots" (
        "id"                    UUID    NOT NULL DEFAULT uuid_generate_v4(),
        "snapshotDate"          DATE    NOT NULL,
        "totalRecordsUploaded"  INTEGER NOT NULL DEFAULT 0,
        "totalAccessGranted"    INTEGER NOT NULL DEFAULT 0,
        "totalAccessRevoked"    INTEGER NOT NULL DEFAULT 0,
        "totalRecordsAmended"   INTEGER NOT NULL DEFAULT 0,
        "totalEmergencyAccess"  INTEGER NOT NULL DEFAULT 0,
        "totalRecordsDeleted"   INTEGER NOT NULL DEFAULT 0,
        "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_analytics_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_analytics_snapshots_date" UNIQUE ("snapshotDate")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_as_date" ON "analytics_snapshots" ("snapshotDate");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs_projection"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "access_grants_read"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "medical_records_read"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projection_checkpoints"`);
  }
}
