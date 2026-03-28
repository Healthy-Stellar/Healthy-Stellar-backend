import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRecordVersionsTable1773100000000 implements MigrationInterface {
  name = 'CreateRecordVersionsTable1773100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "record_versions" (
        "id"               UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "recordId"         UUID        NOT NULL,
        "version"          INTEGER     NOT NULL,
        "cid"              VARCHAR     NOT NULL,
        "encryptedDek"     TEXT,
        "stellarTxHash"    VARCHAR,
        "amendedBy"        VARCHAR     NOT NULL,
        "amendmentReason"  TEXT        NOT NULL,
        "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_record_versions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_record_versions_record_version" UNIQUE ("recordId", "version")
      );
      CREATE INDEX "IDX_record_versions_recordId" ON "record_versions" ("recordId");
      CREATE INDEX "IDX_record_versions_record_version" ON "record_versions" ("recordId", "version");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "record_versions"`);
  }
}
