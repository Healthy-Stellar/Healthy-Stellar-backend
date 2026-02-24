import { MigrationInterface, QueryRunner } from 'typeorm';

export class PharmacyEnhancements1737700000000 implements MigrationInterface {
  name = 'PharmacyEnhancements1737700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create patient_counseling_logs table
    await queryRunner.query(`
      CREATE TABLE "patient_counseling_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "prescription_id" uuid NOT NULL,
        "patient_id" character varying NOT NULL,
        "patient_name" character varying NOT NULL,
        "pharmacist_id" character varying NOT NULL,
        "pharmacist_name" character varying NOT NULL,
        "pharmacist_license" character varying NOT NULL,
        "counseling_topics" text NOT NULL,
        "duration_minutes" integer NOT NULL,
        "counseling_notes" text,
        "patient_questions" text,
        "patient_understood" boolean NOT NULL DEFAULT true,
        "patient_signature" character varying,
        "status" character varying NOT NULL,
        "refusal_reason" text,
        "counseling_date" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_patient_counseling_logs" PRIMARY KEY ("id")
      )
    `);

    // Create medication_error_logs table
    await queryRunner.query(`
      CREATE TABLE "medication_error_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "error_number" character varying NOT NULL,
        "error_type" character varying NOT NULL,
        "severity" character varying NOT NULL,
        "prescription_id" character varying NOT NULL,
        "drug_id" character varying,
        "drug_name" character varying,
        "patient_id" character varying NOT NULL,
        "patient_name" character varying NOT NULL,
        "error_description" text NOT NULL,
        "contributing_factors" text,
        "reported_by" character varying NOT NULL,
        "reporter_role" character varying NOT NULL,
        "discovered_by" character varying,
        "discovered_at" TIMESTAMP,
        "corrective_actions" text,
        "preventive_actions" text,
        "patient_notified" boolean NOT NULL DEFAULT false,
        "prescriber_notified" boolean NOT NULL DEFAULT false,
        "reported_to_fda" boolean NOT NULL DEFAULT false,
        "fda_report_number" character varying,
        "reported_to_ismp" boolean NOT NULL DEFAULT false,
        "follow_up_actions" text,
        "status" character varying NOT NULL,
        "occurred_at" TIMESTAMP NOT NULL DEFAULT now(),
        "reported_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_medication_error_logs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_medication_error_logs_error_number" UNIQUE ("error_number")
      )
    `);

    // Create prescription_refills table
    await queryRunner.query(`
      CREATE TABLE "prescription_refills" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "original_prescription_id" uuid NOT NULL,
        "refill_prescription_id" uuid NOT NULL,
        "refill_number" integer NOT NULL,
        "pharmacist_id" character varying NOT NULL,
        "pharmacist_name" character varying NOT NULL,
        "patient_request_date" date,
        "notes" text,
        "refill_date" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prescription_refills" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "patient_counseling_logs" 
      ADD CONSTRAINT "FK_patient_counseling_logs_prescription" 
      FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "prescription_refills" 
      ADD CONSTRAINT "FK_prescription_refills_original" 
      FOREIGN KEY ("original_prescription_id") REFERENCES "prescriptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "prescription_refills" 
      ADD CONSTRAINT "FK_prescription_refills_refill" 
      FOREIGN KEY ("refill_prescription_id") REFERENCES "prescriptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create indexes for better performance
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_counseling_logs_patient_id" ON "patient_counseling_logs" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_counseling_logs_prescription_id" ON "patient_counseling_logs" ("prescription_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_counseling_logs_pharmacist_id" ON "patient_counseling_logs" ("pharmacist_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_counseling_logs_status" ON "patient_counseling_logs" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_patient_counseling_logs_counseling_date" ON "patient_counseling_logs" ("counseling_date")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_medication_error_logs_error_type" ON "medication_error_logs" ("error_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_medication_error_logs_severity" ON "medication_error_logs" ("severity")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_medication_error_logs_status" ON "medication_error_logs" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_medication_error_logs_patient_id" ON "medication_error_logs" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_medication_error_logs_reported_at" ON "medication_error_logs" ("reported_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_medication_error_logs_occurred_at" ON "medication_error_logs" ("occurred_at")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_prescription_refills_original_prescription_id" ON "prescription_refills" ("original_prescription_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_prescription_refills_refill_prescription_id" ON "prescription_refills" ("refill_prescription_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_prescription_refills_pharmacist_id" ON "prescription_refills" ("pharmacist_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_prescription_refills_refill_date" ON "prescription_refills" ("refill_date")`,
    );

    // Insert sample drug interaction data for common interactions
    await queryRunner.query(`
      INSERT INTO "drug_interactions" ("id", "drug1_id", "drug2_id", "severity", "description", "clinical_effects", "management", "created_at")
      SELECT 
        uuid_generate_v4(),
        d1.id,
        d2.id,
        'major',
        'Warfarin and NSAIDs interaction',
        'Increased risk of bleeding due to antiplatelet effects and potential displacement of warfarin from protein binding sites',
        'Monitor INR closely. Consider alternative analgesic. If combination necessary, use lowest effective NSAID dose for shortest duration.',
        now()
      FROM "drugs" d1, "drugs" d2
      WHERE d1."generic_name" ILIKE '%warfarin%' 
      AND d2."generic_name" ILIKE ANY(ARRAY['%ibuprofen%', '%naproxen%', '%diclofenac%', '%celecoxib%'])
      AND d1.id != d2.id
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "drug_interactions" ("id", "drug1_id", "drug2_id", "severity", "description", "clinical_effects", "management", "created_at")
      SELECT 
        uuid_generate_v4(),
        d1.id,
        d2.id,
        'contraindicated',
        'MAO inhibitor and SSRI interaction',
        'Risk of serotonin syndrome - potentially life-threatening condition with hyperthermia, rigidity, and altered mental status',
        'Contraindicated combination. Allow 2-week washout period when switching between these drug classes.',
        now()
      FROM "drugs" d1, "drugs" d2
      WHERE d1."generic_name" ILIKE ANY(ARRAY['%phenelzine%', '%tranylcypromine%', '%selegiline%'])
      AND d2."generic_name" ILIKE ANY(ARRAY['%sertraline%', '%fluoxetine%', '%paroxetine%', '%citalopram%', '%escitalopram%'])
      AND d1.id != d2.id
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "drug_interactions" ("id", "drug1_id", "drug2_id", "severity", "description", "clinical_effects", "management", "created_at")
      SELECT 
        uuid_generate_v4(),
        d1.id,
        d2.id,
        'major',
        'Digoxin and loop diuretic interaction',
        'Diuretic-induced hypokalemia and hypomagnesemia can increase digoxin toxicity risk',
        'Monitor serum electrolytes and digoxin levels. Correct electrolyte imbalances promptly.',
        now()
      FROM "drugs" d1, "drugs" d2
      WHERE d1."generic_name" ILIKE '%digoxin%'
      AND d2."generic_name" ILIKE ANY(ARRAY['%furosemide%', '%bumetanide%', '%torsemide%'])
      AND d1.id != d2.id
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "drug_interactions" ("id", "drug1_id", "drug2_id", "severity", "description", "clinical_effects", "management", "created_at")
      SELECT 
        uuid_generate_v4(),
        d1.id,
        d2.id,
        'moderate',
        'ACE inhibitor and potassium supplement interaction',
        'Increased risk of hyperkalemia, especially in patients with renal impairment',
        'Monitor serum potassium levels regularly. Consider potassium-sparing alternatives if appropriate.',
        now()
      FROM "drugs" d1, "drugs" d2
      WHERE d1."generic_name" ILIKE ANY(ARRAY['%lisinopril%', '%enalapril%', '%captopril%', '%ramipril%'])
      AND d2."generic_name" ILIKE '%potassium%'
      AND d1.id != d2.id
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "prescription_refills" DROP CONSTRAINT "FK_prescription_refills_refill"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prescription_refills" DROP CONSTRAINT "FK_prescription_refills_original"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_counseling_logs" DROP CONSTRAINT "FK_patient_counseling_logs_prescription"`,
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_prescription_refills_refill_date"`);
    await queryRunner.query(`DROP INDEX "IDX_prescription_refills_pharmacist_id"`);
    await queryRunner.query(`DROP INDEX "IDX_prescription_refills_refill_prescription_id"`);
    await queryRunner.query(`DROP INDEX "IDX_prescription_refills_original_prescription_id"`);
    await queryRunner.query(`DROP INDEX "IDX_medication_error_logs_occurred_at"`);
    await queryRunner.query(`DROP INDEX "IDX_medication_error_logs_reported_at"`);
    await queryRunner.query(`DROP INDEX "IDX_medication_error_logs_patient_id"`);
    await queryRunner.query(`DROP INDEX "IDX_medication_error_logs_status"`);
    await queryRunner.query(`DROP INDEX "IDX_medication_error_logs_severity"`);
    await queryRunner.query(`DROP INDEX "IDX_medication_error_logs_error_type"`);
    await queryRunner.query(`DROP INDEX "IDX_patient_counseling_logs_counseling_date"`);
    await queryRunner.query(`DROP INDEX "IDX_patient_counseling_logs_status"`);
    await queryRunner.query(`DROP INDEX "IDX_patient_counseling_logs_pharmacist_id"`);
    await queryRunner.query(`DROP INDEX "IDX_patient_counseling_logs_prescription_id"`);
    await queryRunner.query(`DROP INDEX "IDX_patient_counseling_logs_patient_id"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "prescription_refills"`);
    await queryRunner.query(`DROP TABLE "medication_error_logs"`);
    await queryRunner.query(`DROP TABLE "patient_counseling_logs"`);
  }
}
