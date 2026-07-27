import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateArchivedRecordsTable1782900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "archived_records" (
        "id"                  UUID                     NOT NULL DEFAULT gen_random_uuid(),
        "entity_type"         VARCHAR(64)              NOT NULL,
        "original_id"         VARCHAR                  NOT NULL,
        "tenant_id"           UUID,
        "policy_id"           VARCHAR(128)             NOT NULL,
        "payload"             JSONB                    NOT NULL,
        "original_created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "archived_at"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_archived_records" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_archived_records_entity_type_tenant_id" ON "archived_records" ("entity_type", "tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_archived_records_entity_type_original_id" ON "archived_records" ("entity_type", "original_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_archived_records_entity_type_original_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_archived_records_entity_type_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "archived_records"`);
  }
}
