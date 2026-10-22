import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIncidentEvidenceTable1775800000000 implements MigrationInterface {
  name = 'CreateIncidentEvidenceTable1775800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."incident_evidence_severity_enum" AS ENUM (
        'low', 'medium', 'high', 'critical'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."incident_evidence_status_enum" AS ENUM (
        'open', 'investigating', 'resolved'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "incident_evidence" (
        "id"               UUID NOT NULL DEFAULT uuid_generate_v4(),
        "title"            VARCHAR(255) NOT NULL,
        "description"      TEXT,
        "severity"         "public"."incident_evidence_severity_enum" NOT NULL DEFAULT 'high',
        "status"           "public"."incident_evidence_status_enum"   NOT NULL DEFAULT 'open',
        "triggeredBy"      VARCHAR(255),
        "traceId"          VARCHAR(64),
        "memorySnapshot"   JSONB,
        "cpuSnapshot"      JSONB,
        "queueSnapshot"    JSONB,
        "recentLogs"       JSONB,
        "traceContext"     JSONB,
        "metadata"         JSONB,
        "notes"            TEXT,
        "capturedAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "resolvedAt"       TIMESTAMP,
        "resolvedBy"       VARCHAR(255),
        CONSTRAINT "PK_incident_evidence" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_incident_evidence_severity_status"
        ON "incident_evidence" ("severity", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_incident_evidence_capturedAt"
        ON "incident_evidence" ("capturedAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_incident_evidence_capturedAt"`);
    await queryRunner.query(`DROP INDEX "IDX_incident_evidence_severity_status"`);
    await queryRunner.query(`DROP TABLE "incident_evidence"`);
    await queryRunner.query(`DROP TYPE "public"."incident_evidence_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."incident_evidence_severity_enum"`);
  }
}
