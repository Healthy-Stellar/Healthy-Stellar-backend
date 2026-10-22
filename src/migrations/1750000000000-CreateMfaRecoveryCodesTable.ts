import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMfaRecoveryCodesTable1750000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "mfa_recovery_codes" (
        "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
        "userId"      character varying        NOT NULL,
        "codeHash"    character varying(512)   NOT NULL,
        "consumedAt"  TIMESTAMP WITH TIME ZONE          DEFAULT NULL,
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mfa_recovery_codes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mfa_recovery_codes_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_mfa_recovery_codes_userId"
        ON "mfa_recovery_codes" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_mfa_recovery_codes_userId_consumedAt"
        ON "mfa_recovery_codes" ("userId", "consumedAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "mfa_recovery_codes"`);
  }
}
