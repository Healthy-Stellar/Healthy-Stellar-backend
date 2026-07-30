import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmergencyMedicalInfoAndHospitalRegistry1774300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "blood_type_enum" AS ENUM (
        'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "emergency_medical_info" (
        "id"                  UUID              NOT NULL DEFAULT uuid_generate_v4(),
        "patientId"           UUID              NOT NULL,
        "bloodType"           "blood_type_enum" NOT NULL DEFAULT 'unknown',
        "allergies"           TEXT[]            NOT NULL DEFAULT '{}',
        "currentMedications"  TEXT[]            NOT NULL DEFAULT '{}',
        "chronicConditions"   TEXT[]            NOT NULL DEFAULT '{}',
        "dnrStatus"           BOOLEAN           NOT NULL DEFAULT false,
        "emergencyContacts"   JSONB,
        "insuranceInfo"       TEXT,
        "additionalNotes"     TEXT,
        "createdAt"           TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_emergency_medical_info" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_emergency_medical_info_patientId"
        ON "emergency_medical_info" ("patientId")
    `);

    await queryRunner.query(`
      CREATE TYPE "hospital_type_enum" AS ENUM (
        'general', 'specialty', 'teaching', 'rehabilitation', 'psychiatric', 'children'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "hospital_status_enum" AS ENUM (
        'active', 'inactive', 'suspended'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "hospital_registry" (
        "id"            UUID                    NOT NULL DEFAULT uuid_generate_v4(),
        "name"          VARCHAR(255)            NOT NULL,
        "licenseNumber" VARCHAR(100)            NOT NULL,
        "type"          "hospital_type_enum"    NOT NULL DEFAULT 'general',
        "status"        "hospital_status_enum"  NOT NULL DEFAULT 'active',
        "address"       VARCHAR(500)            NOT NULL,
        "city"          VARCHAR(100)            NOT NULL,
        "country"       VARCHAR(100)            NOT NULL,
        "phone"         VARCHAR(20),
        "email"         VARCHAR(255),
        "totalBeds"     INT,
        "departments"   TEXT[]                  NOT NULL DEFAULT '{}',
        "metadata"      JSONB,
        "createdAt"     TIMESTAMP               NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP               NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hospital_registry" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_hospital_registry_licenseNumber"
        ON "hospital_registry" ("licenseNumber")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "hospital_registry"`);
    await queryRunner.query(`DROP TYPE "hospital_status_enum"`);
    await queryRunner.query(`DROP TYPE "hospital_type_enum"`);
    await queryRunner.query(`DROP TABLE "emergency_medical_info"`);
    await queryRunner.query(`DROP TYPE "blood_type_enum"`);
  }
}
