import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHttpIdempotencyKeys1775500000000 implements MigrationInterface {
  name = 'CreateHttpIdempotencyKeys1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "http_idempotency_keys" (
        "id"                   UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "key"                  VARCHAR(512) NOT NULL,
        "status_code"          INTEGER      NOT NULL,
        "body"                 JSONB        NOT NULL,
        "headers"              JSONB        NOT NULL DEFAULT '{}',
        "request_fingerprint"  VARCHAR(512) NOT NULL,
        "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_http_idempotency_keys" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_http_idempotency_keys_key" UNIQUE ("key")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_http_idempotency_keys_created_at"
        ON "http_idempotency_keys" ("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "http_idempotency_keys";`);
  }
}
