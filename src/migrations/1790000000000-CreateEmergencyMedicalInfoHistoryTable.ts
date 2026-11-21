import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmergencyMedicalInfoHistoryTable1790000000000 implements MigrationInterface {
  name = 'CreateEmergencyMedicalInfoHistoryTable1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "emergency_medical_info_history" (
        "id"                        UUID                     NOT NULL DEFAULT uuid_generate_v4(),
        "emergencyMedicalInfoId"    UUID                     NOT NULL,
        "patientId"                 UUID                     NOT NULL,
        "previousValues"            JSONB,
        "newValues"                 JSONB,
        "performedBy"               UUID,
        "createdAt"                 TIMESTAMP                NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_emergency_medical_info_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_emergency_medical_info_history_info" FOREIGN KEY ("emergencyMedicalInfoId") REFERENCES "emergency_medical_info"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_emergency_medical_info_history_info_id_created_at"
        ON "emergency_medical_info_history" ("emergencyMedicalInfoId", "createdAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_emergency_medical_info_history_patient_id_created_at"
        ON "emergency_medical_info_history" ("patientId", "createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "emergency_medical_info_history"`);
  }
}
