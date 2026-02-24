import { MigrationInterface, QueryRunner } from 'typeorm';

export class MedicationAdministration1737554500000 implements MigrationInterface {
  name = 'MedicationAdministration1737554500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create medication_administration_records table
    await queryRunner.query(`
      CREATE TABLE "medication_administration_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "patient_id" uuid NOT NULL,
        "prescription_id" uuid NOT NULL,
        "medication_id" uuid NOT NULL,
        "medication_name" character varying(255) NOT NULL,
        "medication_barcode" character varying(100),
        "dosage" character varying(100) NOT NULL,
        "route" character varying NOT NULL,
        "scheduled_time" TIMESTAMP NOT NULL,
        "administration_time" TIMESTAMP,
        "status" character varying NOT NULL DEFAULT 'scheduled',
        "nurse_id" uuid,
        "nurse_name" character varying(255),
        "witness_id" uuid,
        "witness_name" character varying(255),
        "barcode_verified" boolean NOT NULL DEFAULT false,
        "patient_verified" boolean NOT NULL DEFAULT false,
        "medication_verified" boolean NOT NULL DEFAULT false,
        "dose_verified" boolean NOT NULL DEFAULT false,
        "route_verified" boolean NOT NULL DEFAULT false,
        "time_verified" boolean NOT NULL DEFAULT false,
        "administration_notes" text,
        "refusal_reason" text,
        "hold_reason" text,
        "site_of_administration" character varying(255),
        "lot_number" character varying(100),
        "expiration_date" date,
        "is_prn" boolean NOT NULL DEFAULT false,
        "prn_reason" text,
        "is_high_alert" boolean NOT NULL DEFAULT false,
        "requires_witness" boolean NOT NULL DEFAULT false,
        "administration_date" date NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_medication_administration_records" PRIMARY KEY ("id")
      )
    `);

    // Create missed_doses table
    await queryRunner.query(`
      CREATE TABLE "missed_doses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mar_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "medication_name" character varying(255) NOT NULL,
        "scheduled_time" TIMESTAMP NOT NULL,
        "missed_date" date NOT NULL,
        "reason" character varying NOT NULL,
        "reason_details" text,
        "nurse_id" uuid NOT NULL,
        "nurse_name" character varying(255) NOT NULL,
        "follow_up_status" character varying NOT NULL DEFAULT 'pending',
        "follow_up_notes" text,
        "physician_notified" boolean NOT NULL DEFAULT false,
        "physician_notification_time" TIMESTAMP,
        "rescheduled_time" TIMESTAMP,
        "is_critical_medication" boolean NOT NULL DEFAULT false,
        "alert_sent" boolean NOT NULL DEFAULT false,
        "alert_sent_time" TIMESTAMP,
        "resolved_by" uuid,
        "resolved_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_missed_doses" PRIMARY KEY ("id")
      )
    `);

    // Create adverse_drug_reactions table
    await queryRunner.query(`
      CREATE TABLE "adverse_drug_reactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mar_id" uuid,
        "patient_id" uuid NOT NULL,
        "medication_name" character varying(255) NOT NULL,
        "medication_id" uuid,
        "dosage" character varying(100),
        "reaction_date" TIMESTAMP NOT NULL,
        "severity" character varying NOT NULL,
        "reaction_type" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "symptoms" text NOT NULL,
        "onset_time" character varying(100),
        "duration" character varying(100),
        "treatment_given" text,
        "outcome" text,
        "reporter_id" uuid NOT NULL,
        "reporter_name" character varying(255) NOT NULL,
        "reporter_role" character varying(100) NOT NULL,
        "physician_notified" boolean NOT NULL DEFAULT false,
        "physician_notification_time" TIMESTAMP,
        "pharmacy_notified" boolean NOT NULL DEFAULT false,
        "pharmacy_notification_time" TIMESTAMP,
        "fda_reported" boolean NOT NULL DEFAULT false,
        "fda_report_number" character varying(100),
        "medication_discontinued" boolean NOT NULL DEFAULT false,
        "discontinuation_date" TIMESTAMP,
        "rechallenge_attempted" boolean NOT NULL DEFAULT false,
        "rechallenge_result" text,
        "concomitant_medications" text,
        "medical_history_relevant" text,
        "lab_values" text,
        "follow_up_required" boolean NOT NULL DEFAULT false,
        "follow_up_date" date,
        "resolved_date" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_adverse_drug_reactions" PRIMARY KEY ("id")
      )
    `);

    // Create barcode_verifications table
    await queryRunner.query(`
      CREATE TABLE "barcode_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mar_id" uuid NOT NULL,
        "verification_type" character varying NOT NULL,
        "scanned_barcode" character varying(255) NOT NULL,
        "expected_barcode" character varying(255),
        "status" character varying NOT NULL,
        "verification_time" TIMESTAMP NOT NULL,
        "nurse_id" uuid NOT NULL,
        "nurse_name" character varying(255) NOT NULL,
        "device_id" character varying(100),
        "error_message" text,
        "override_reason" text,
        "override_authorized_by" uuid,
        "override_authorization_time" TIMESTAMP,
        "patient_id_verified" boolean NOT NULL DEFAULT false,
        "medication_id_verified" boolean NOT NULL DEFAULT false,
        "dose_verified" boolean NOT NULL DEFAULT false,
        "route_verified" boolean NOT NULL DEFAULT false,
        "time_verified" boolean NOT NULL DEFAULT false,
        "verification_notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_barcode_verifications" PRIMARY KEY ("id")
      )
    `);

    // Create medication_reconciliations table
    await queryRunner.query(`
      CREATE TABLE "medication_reconciliations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "patient_id" uuid NOT NULL,
        "reconciliation_type" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "initiated_by" uuid NOT NULL,
        "initiated_by_name" character varying(255) NOT NULL,
        "initiated_by_role" character varying(100) NOT NULL,
        "pharmacist_id" uuid,
        "pharmacist_name" character varying(255),
        "physician_id" uuid,
        "physician_name" character varying(255),
        "home_medications" json,
        "current_medications" json,
        "reconciled_medications" json,
        "discrepancies_found" json,
        "actions_taken" json,
        "allergies_reviewed" boolean NOT NULL DEFAULT false,
        "drug_interactions_checked" boolean NOT NULL DEFAULT false,
        "duplicate_therapy_checked" boolean NOT NULL DEFAULT false,
        "renal_dosing_checked" boolean NOT NULL DEFAULT false,
        "hepatic_dosing_checked" boolean NOT NULL DEFAULT false,
        "reconciliation_notes" text,
        "patient_interview_completed" boolean NOT NULL DEFAULT false,
        "family_interview_completed" boolean NOT NULL DEFAULT false,
        "pharmacy_contacted" boolean NOT NULL DEFAULT false,
        "primary_care_contacted" boolean NOT NULL DEFAULT false,
        "medication_list_provided" boolean NOT NULL DEFAULT false,
        "patient_education_completed" boolean NOT NULL DEFAULT false,
        "completed_at" TIMESTAMP,
        "completed_by" uuid,
        "review_required_reason" text,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_medication_reconciliations" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for performance
    await queryRunner.query(
      `CREATE INDEX "IDX_mar_patient_scheduled_time" ON "medication_administration_records" ("patient_id", "scheduled_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mar_nurse_administration_date" ON "medication_administration_records" ("nurse_id", "administration_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mar_medication_status" ON "medication_administration_records" ("medication_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mar_scheduled_time" ON "medication_administration_records" ("scheduled_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mar_status" ON "medication_administration_records" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mar_administration_date" ON "medication_administration_records" ("administration_date")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_missed_dose_patient_date" ON "missed_doses" ("patient_id", "missed_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_missed_dose_follow_up_status" ON "missed_doses" ("follow_up_status")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_adr_patient_reaction_date" ON "adverse_drug_reactions" ("patient_id", "reaction_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_adr_severity_status" ON "adverse_drug_reactions" ("severity", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_adr_medication_name" ON "adverse_drug_reactions" ("medication_name")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_barcode_mar_id" ON "barcode_verifications" ("mar_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_barcode_type_status" ON "barcode_verifications" ("verification_type", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_barcode_nurse_time" ON "barcode_verifications" ("nurse_id", "verification_time")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_reconciliation_patient_type" ON "medication_reconciliations" ("patient_id", "reconciliation_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reconciliation_status_created" ON "medication_reconciliations" ("status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reconciliation_pharmacist" ON "medication_reconciliations" ("pharmacist_id")`,
    );

    // Add foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "missed_doses" ADD CONSTRAINT "FK_missed_doses_mar" FOREIGN KEY ("mar_id") REFERENCES "medication_administration_records"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "adverse_drug_reactions" ADD CONSTRAINT "FK_adverse_drug_reactions_mar" FOREIGN KEY ("mar_id") REFERENCES "medication_administration_records"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "barcode_verifications" ADD CONSTRAINT "FK_barcode_verifications_mar" FOREIGN KEY ("mar_id") REFERENCES "medication_administration_records"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "barcode_verifications" DROP CONSTRAINT "FK_barcode_verifications_mar"`,
    );
    await queryRunner.query(
      `ALTER TABLE "adverse_drug_reactions" DROP CONSTRAINT "FK_adverse_drug_reactions_mar"`,
    );
    await queryRunner.query(`ALTER TABLE "missed_doses" DROP CONSTRAINT "FK_missed_doses_mar"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_reconciliation_pharmacist"`);
    await queryRunner.query(`DROP INDEX "IDX_reconciliation_status_created"`);
    await queryRunner.query(`DROP INDEX "IDX_reconciliation_patient_type"`);
    await queryRunner.query(`DROP INDEX "IDX_barcode_nurse_time"`);
    await queryRunner.query(`DROP INDEX "IDX_barcode_type_status"`);
    await queryRunner.query(`DROP INDEX "IDX_barcode_mar_id"`);
    await queryRunner.query(`DROP INDEX "IDX_adr_medication_name"`);
    await queryRunner.query(`DROP INDEX "IDX_adr_severity_status"`);
    await queryRunner.query(`DROP INDEX "IDX_adr_patient_reaction_date"`);
    await queryRunner.query(`DROP INDEX "IDX_missed_dose_follow_up_status"`);
    await queryRunner.query(`DROP INDEX "IDX_missed_dose_patient_date"`);
    await queryRunner.query(`DROP INDEX "IDX_mar_administration_date"`);
    await queryRunner.query(`DROP INDEX "IDX_mar_status"`);
    await queryRunner.query(`DROP INDEX "IDX_mar_scheduled_time"`);
    await queryRunner.query(`DROP INDEX "IDX_mar_medication_status"`);
    await queryRunner.query(`DROP INDEX "IDX_mar_nurse_administration_date"`);
    await queryRunner.query(`DROP INDEX "IDX_mar_patient_scheduled_time"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "medication_reconciliations"`);
    await queryRunner.query(`DROP TABLE "barcode_verifications"`);
    await queryRunner.query(`DROP TABLE "adverse_drug_reactions"`);
    await queryRunner.query(`DROP TABLE "missed_doses"`);
    await queryRunner.query(`DROP TABLE "medication_administration_records"`);
  }
}
