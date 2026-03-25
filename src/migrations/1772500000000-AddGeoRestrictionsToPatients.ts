import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeoRestrictionsToPatients1772500000000 implements MigrationInterface {
  name = 'AddGeoRestrictionsToPatients1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "allowedCountries" text DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" DROP COLUMN IF EXISTS "allowedCountries"`,
    );
  }
}
