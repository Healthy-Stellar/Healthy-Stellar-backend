import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrCodeToEmergencyMedicalInfo1776200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "emergency_medical_info"
        ADD COLUMN IF NOT EXISTS "qrOptIn"    BOOLEAN   NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "qrToken"    UUID               DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "qrIssuedAt" TIMESTAMP          DEFAULT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_emergency_medical_info_qrToken"
        ON "emergency_medical_info" ("qrToken")
        WHERE "qrToken" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_emergency_medical_info_qrToken"
    `);

    await queryRunner.query(`
      ALTER TABLE "emergency_medical_info"
        DROP COLUMN IF EXISTS "qrIssuedAt",
        DROP COLUMN IF EXISTS "qrToken",
        DROP COLUMN IF EXISTS "qrOptIn"
    `);
  }
}
