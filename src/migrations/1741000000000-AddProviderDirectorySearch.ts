import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderDirectorySearch1741000000000 implements MigrationInterface {
  name = 'AddProviderDirectorySearch1741000000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "displayName" varchar(200)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "institution" varchar(255)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "specialty" varchar(255)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stellarPublicKey" varchar(255)`);

    await queryRunner.query(`
      UPDATE "users"
      SET "displayName" = TRIM(CONCAT(COALESCE("firstName", ''), ' ', COALESCE("lastName", '')))
      WHERE "displayName" IS NULL OR BTRIM("displayName") = ''
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "specialty" = "specialization"
      WHERE "specialty" IS NULL
        AND "specialization" IS NOT NULL
        AND BTRIM("specialization") <> ''
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "search_vector" tsvector
      GENERATED ALWAYS AS (
        to_tsvector(
          'english',
          COALESCE("displayName", '') || ' ' ||
          COALESCE("institution", '') || ' ' ||
          COALESCE("specialty", '') || ' ' ||
          COALESCE("specialization", '')
        )
      ) STORED
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_users_search_vector_gin"
      ON "users" USING GIN ("search_vector")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_users_search_vector_gin"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "search_vector"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "stellarPublicKey"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "specialty"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "institution"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "displayName"`);
  }
}
