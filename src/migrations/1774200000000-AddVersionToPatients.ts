import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVersionToPatients1774200000000 implements MigrationInterface {
  name = 'AddVersionToPatients1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "version"`);
  }
}
