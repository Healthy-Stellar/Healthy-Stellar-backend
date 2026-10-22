import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetTokenToUsers1775800000000 implements MigrationInterface {
  name = 'AddPasswordResetTokenToUsers1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetToken" VARCHAR(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetTokenExpiresAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_passwordResetToken" ON "users" ("passwordResetToken")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_passwordResetToken"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetTokenExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetToken"`);
  }
}
