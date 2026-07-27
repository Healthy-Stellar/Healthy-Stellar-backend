import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrescriptionDispensingAndDoctorLink1782700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── prescriptions: new columns for the CRUD + dispense workflow ──────────
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
        ADD COLUMN IF NOT EXISTS "patientName" VARCHAR,
        ADD COLUMN IF NOT EXISTS "patientAllergies" TEXT,
        ADD COLUMN IF NOT EXISTS "prescriberId" UUID,
        ADD COLUMN IF NOT EXISTS "refillsAllowed" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "prescriptionDate" DATE,
        ADD COLUMN IF NOT EXISTS "dispensedBy" VARCHAR,
        ADD COLUMN IF NOT EXISTS "dispensedAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "dispenseInteractionCheck" TEXT
    `);

    // Backfill new columns from the legacy columns they replace so existing
    // rows keep working with the new CRUD/dispense code paths.
    await queryRunner.query(`
      UPDATE "prescriptions"
      SET
        "prescriberId" = COALESCE("prescriberId", "providerId"),
        "refillsAllowed" = COALESCE("refillsAllowed", "refills", 0),
        "refillsRemaining" = COALESCE("refillsRemaining", "refills", 0),
        "prescriptionDate" = COALESCE("prescriptionDate", "prescribedDate")
    `);

    await queryRunner.query(`
      ALTER TABLE "prescriptions"
        ALTER COLUMN "providerId" DROP NOT NULL,
        ALTER COLUMN "drugName" DROP NOT NULL,
        ALTER COLUMN "dosage" DROP NOT NULL,
        ALTER COLUMN "quantity" DROP NOT NULL,
        ALTER COLUMN "refills" DROP NOT NULL,
        ALTER COLUMN "instructions" DROP NOT NULL,
        ALTER COLUMN "prescribedDate" DROP NOT NULL,
        ALTER COLUMN "prescriptionNumber" DROP NOT NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prescriptions_prescriberId" ON "prescriptions" ("prescriberId")`,
    );

    // ── prescription_dispense_records: dispensing history / transactions ────
    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "prescription_dispense_severity_enum"
        AS ENUM ('none', 'minor', 'moderate', 'major', 'contraindicated')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prescription_dispense_records" (
        "id"                  UUID      NOT NULL DEFAULT gen_random_uuid(),
        "prescription_id"     UUID      NOT NULL,
        "drugId"              UUID      NOT NULL,
        "quantityDispensed"   INTEGER   NOT NULL,
        "pharmacistId"        VARCHAR   NOT NULL,
        "interactionSeverity" "prescription_dispense_severity_enum" NOT NULL DEFAULT 'none',
        "interactionCheck"    TEXT,
        "notes"               TEXT,
        "dispensedAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prescription_dispense_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_prescription_dispense_records_prescription" FOREIGN KEY ("prescription_id")
          REFERENCES "prescriptions" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prescription_dispense_records_prescription_id" ON "prescription_dispense_records" ("prescription_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_prescription_dispense_records_prescription_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "prescription_dispense_records"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "prescription_dispense_severity_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescriptions_prescriberId"`);

    await queryRunner.query(`
      ALTER TABLE "prescriptions"
        DROP COLUMN IF EXISTS "patientName",
        DROP COLUMN IF EXISTS "patientAllergies",
        DROP COLUMN IF EXISTS "prescriberId",
        DROP COLUMN IF EXISTS "refillsAllowed",
        DROP COLUMN IF EXISTS "prescriptionDate",
        DROP COLUMN IF EXISTS "dispensedBy",
        DROP COLUMN IF EXISTS "dispensedAt",
        DROP COLUMN IF EXISTS "dispenseInteractionCheck"
    `);
  }
}
