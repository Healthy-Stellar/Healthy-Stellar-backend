import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmergencyAccessOverride1741100000000 implements MigrationInterface {
  name = 'AddEmergencyAccessOverride1741100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "access_grants"
      ADD COLUMN IF NOT EXISTS "isEmergency" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "access_grants"
      ADD COLUMN IF NOT EXISTS "emergencyReason" text
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "emergencyAccessEnabled" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_access_grants_emergency_expires"
      ON "access_grants" ("isEmergency", "expiresAt", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_access_grants_emergency_expires"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emergencyAccessEnabled"`);
    await queryRunner.query(`ALTER TABLE "access_grants" DROP COLUMN IF EXISTS "emergencyReason"`);
    await queryRunner.query(`ALTER TABLE "access_grants" DROP COLUMN IF EXISTS "isEmergency"`);
  }
}
