import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationPreferencesToPatients1772700000000 implements MigrationInterface {
  name = 'AddNotificationPreferencesToPatients1772700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "isPhoneVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "notificationPreferences" jsonb NOT NULL DEFAULT '{"newRecord":true,"accessGranted":true,"accessRevoked":true,"appointmentReminder":true,"channels":["WEBSOCKET"]}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" DROP COLUMN IF EXISTS "notificationPreferences"`,
    );
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "isPhoneVerified"`);
  }
}
