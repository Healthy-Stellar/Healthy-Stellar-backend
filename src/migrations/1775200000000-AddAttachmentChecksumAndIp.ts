import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttachmentChecksumAndIp1775200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "medical_attachments"
        ADD COLUMN IF NOT EXISTS "checksum"        VARCHAR(64),
        ADD COLUMN IF NOT EXISTS "uploaded_by_ip"  VARCHAR(45)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "medical_attachments"
        DROP COLUMN IF EXISTS "checksum",
        DROP COLUMN IF EXISTS "uploaded_by_ip"
    `);
  }
}
