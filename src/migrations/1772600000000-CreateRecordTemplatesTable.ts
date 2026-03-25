import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRecordTemplatesTable1772600000000 implements MigrationInterface {
  name = 'CreateRecordTemplatesTable1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "record_templates" (
        "id"          uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "providerId"  character varying NOT NULL,
        "name"        character varying NOT NULL,
        "recordType"  character varying NOT NULL,
        "schemaJson"  jsonb             NOT NULL,
        "isPublic"    boolean           NOT NULL DEFAULT false,
        "createdAt"   TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_record_templates" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_record_templates_providerId" ON "record_templates" ("providerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_record_templates_isPublic" ON "record_templates" ("isPublic")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "record_templates"`);
  }
}
