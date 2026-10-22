import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientEnumConstraints1775900000000 implements MigrationInterface {
  name = 'AddPatientEnumConstraints1775900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    // Normalize sex: lower case, defaults to 'unknown' if invalid or null
    await queryRunner.query(
      `UPDATE "patients" SET "sex" = LOWER("sex") WHERE "sex" IS NOT NULL`
    );
    await queryRunner.query(
      `UPDATE "patients" SET "sex" = 'unknown' WHERE "sex" NOT IN ('male', 'female', 'other', 'unknown') OR "sex" IS NULL`
    );

    // Normalize bloodGroup: upper case, set to null if invalid
    await queryRunner.query(
      `UPDATE "patients" SET "bloodGroup" = UPPER("bloodGroup") WHERE "bloodGroup" IS NOT NULL`
    );
    await queryRunner.query(
      `UPDATE "patients" SET "bloodGroup" = NULL WHERE "bloodGroup" NOT IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') AND "bloodGroup" IS NOT NULL`
    );

    if (isPostgres) {
      // Postgres-specific Enum and constraints
      // First, create sex enum if not exists
      await queryRunner.query(
        `DO $$ BEGIN
          CREATE TYPE "patients_sex_enum" AS ENUM('male', 'female', 'other', 'unknown');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;`
      );

      // Create bloodGroup enum if not exists
      await queryRunner.query(
        `DO $$ BEGIN
          CREATE TYPE "patients_bloodgroup_enum" AS ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;`
      );

      // Alter columns to enum types
      await queryRunner.query(
        `ALTER TABLE "patients" ALTER COLUMN "sex" TYPE "patients_sex_enum" USING "sex"::"patients_sex_enum"`
      );
      await queryRunner.query(
        `ALTER TABLE "patients" ALTER COLUMN "sex" SET DEFAULT 'unknown'`
      );
      await queryRunner.query(
        `ALTER TABLE "patients" ALTER COLUMN "sex" SET NOT NULL`
      );

      await queryRunner.query(
        `ALTER TABLE "patients" ALTER COLUMN "bloodGroup" TYPE "patients_bloodgroup_enum" USING "bloodGroup"::"patients_bloodgroup_enum"`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "sex" TYPE varchar`);
      await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "sex" DROP DEFAULT`);
      await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "bloodGroup" TYPE varchar`);
      await queryRunner.query(`DROP TYPE IF EXISTS "patients_sex_enum"`);
      await queryRunner.query(`DROP TYPE IF EXISTS "patients_bloodgroup_enum"`);
    }
  }
}
