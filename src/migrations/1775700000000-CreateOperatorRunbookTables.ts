import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOperatorRunbookTables1775700000000 implements MigrationInterface {
  name = 'CreateOperatorRunbookTables1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums
    await queryRunner.query(`
      CREATE TYPE "operator_runbooks_category_enum" AS ENUM (
        'database_recovery',
        'service_restart',
        'data_correction',
        'tenant_recovery',
        'queue_drain',
        'cache_flush',
        'security_incident',
        'general'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "operator_runbooks_status_enum" AS ENUM (
        'draft',
        'active',
        'deprecated',
        'archived'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "runbook_executions_status_enum" AS ENUM (
        'pending_approval',
        'approved',
        'in_progress',
        'completed',
        'failed',
        'rolled_back',
        'cancelled'
      )
    `);

    // operator_runbooks table
    await queryRunner.query(`
      CREATE TABLE "operator_runbooks" (
        "id"                    UUID NOT NULL DEFAULT uuid_generate_v4(),
        "name"                  VARCHAR(255) NOT NULL,
        "description"           TEXT NOT NULL,
        "category"              "operator_runbooks_category_enum" NOT NULL DEFAULT 'general',
        "status"                "operator_runbooks_status_enum" NOT NULL DEFAULT 'draft',
        "steps"                 JSONB NOT NULL,
        "version"               VARCHAR(50) NOT NULL DEFAULT '1.0.0',
        "createdBy"             UUID NOT NULL,
        "updatedBy"             UUID,
        "rollbackProcedure"     TEXT,
        "requiredRoles"         JSONB,
        "requiresDualApproval"  BOOLEAN NOT NULL DEFAULT false,
        "tags"                  JSONB,
        "metadata"              JSONB,
        "createdAt"             TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"             TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_operator_runbooks" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_operator_runbooks_category_status"
        ON "operator_runbooks" ("category", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_operator_runbooks_createdBy_createdAt"
        ON "operator_runbooks" ("createdBy", "createdAt")
    `);

    // runbook_executions table
    await queryRunner.query(`
      CREATE TABLE "runbook_executions" (
        "id"                UUID NOT NULL DEFAULT uuid_generate_v4(),
        "runbookId"         UUID NOT NULL,
        "status"            "runbook_executions_status_enum" NOT NULL DEFAULT 'pending_approval',
        "initiatedBy"       UUID NOT NULL,
        "executedBy"        UUID,
        "approvedBy"        UUID,
        "secondApprovalBy"  UUID,
        "approvedAt"        TIMESTAMP,
        "startedAt"         TIMESTAMP,
        "completedAt"       TIMESTAMP,
        "stepResults"       JSONB,
        "reason"            TEXT,
        "notes"             TEXT,
        "context"           JSONB,
        "errorMessage"      TEXT,
        "dryRun"            BOOLEAN NOT NULL DEFAULT false,
        "ipAddress"         VARCHAR(50),
        "userAgent"         TEXT,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_runbook_executions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_runbook_executions_runbook"
          FOREIGN KEY ("runbookId") REFERENCES "operator_runbooks"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_runbook_executions_runbookId_createdAt"
        ON "runbook_executions" ("runbookId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_runbook_executions_status_createdAt"
        ON "runbook_executions" ("status", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_runbook_executions_executedBy_createdAt"
        ON "runbook_executions" ("executedBy", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "runbook_executions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "operator_runbooks"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "runbook_executions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "operator_runbooks_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "operator_runbooks_category_enum"`);
  }
}
