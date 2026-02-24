import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentConsultationSystem1737700000000 implements MigrationInterface {
  name = 'AppointmentConsultationSystem1737700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Appointments table
    await queryRunner.query(`
            CREATE TABLE "appointments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "patient_id" character varying NOT NULL,
                "doctor_id" character varying NOT NULL,
                "appointment_date" TIMESTAMP NOT NULL,
                "duration" integer NOT NULL,
                "type" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'scheduled',
                "priority" integer NOT NULL DEFAULT 2,
                "specialty" character varying,
                "reason" text,
                "notes" text,
                "is_telemedicine" boolean NOT NULL DEFAULT false,
                "telemedicine_link" character varying,
                "reminder_sent" boolean NOT NULL DEFAULT false,
                "reminder_sent_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_appointments" PRIMARY KEY ("id")
            )
        `);

    // Doctor Availability table
    await queryRunner.query(`
            CREATE TABLE "doctor_availability" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "doctor_id" character varying NOT NULL,
                "day_of_week" integer NOT NULL,
                "start_time" time NOT NULL,
                "end_time" time NOT NULL,
                "slot_duration" integer NOT NULL DEFAULT 30,
                "max_appointments_per_day" integer NOT NULL DEFAULT 20,
                "specialties" text,
                "status" character varying NOT NULL DEFAULT 'available',
                "effective_from" TIMESTAMP NOT NULL,
                "effective_to" TIMESTAMP,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_doctor_availability" PRIMARY KEY ("id")
            )
        `);

    // Consultation Notes table
    await queryRunner.query(`
            CREATE TABLE "consultation_notes" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "appointment_id" uuid NOT NULL,
                "doctor_id" character varying NOT NULL,
                "symptoms" text NOT NULL,
                "diagnosis" text NOT NULL,
                "treatment" text,
                "prescription" text,
                "outcome" character varying NOT NULL,
                "recommendations" text,
                "follow_up_required" boolean NOT NULL DEFAULT false,
                "follow_up_date" TIMESTAMP,
                "referred_to" character varying,
                "vitals" json,
                "attachments" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_consultation_notes" PRIMARY KEY ("id")
            )
        `);

    // Appointment Reminders table
    await queryRunner.query(`
            CREATE TABLE "appointment_reminders" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "appointment_id" character varying NOT NULL,
                "type" character varying NOT NULL,
                "scheduled_time" TIMESTAMP NOT NULL,
                "status" character varying NOT NULL DEFAULT 'pending',
                "message" text NOT NULL,
                "recipient" character varying,
                "sent_at" TIMESTAMP,
                "delivery_status" character varying,
                "error_message" character varying,
                "retry_count" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_appointment_reminders" PRIMARY KEY ("id")
            )
        `);

    // Add foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "consultation_notes" 
            ADD CONSTRAINT "FK_consultation_notes_appointment" 
            FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE
        `);

    // Create indexes for better performance
    await queryRunner.query(
      `CREATE INDEX "IDX_appointments_doctor_id" ON "appointments" ("doctor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointments_patient_id" ON "appointments" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointments_date" ON "appointments" ("appointment_date")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_appointments_status" ON "appointments" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_appointments_priority" ON "appointments" ("priority")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_appointments_type" ON "appointments" ("type")`);

    await queryRunner.query(
      `CREATE INDEX "IDX_doctor_availability_doctor_id" ON "doctor_availability" ("doctor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_doctor_availability_day_of_week" ON "doctor_availability" ("day_of_week")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_doctor_availability_status" ON "doctor_availability" ("status")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_consultation_notes_appointment_id" ON "consultation_notes" ("appointment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_consultation_notes_doctor_id" ON "consultation_notes" ("doctor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_consultation_notes_outcome" ON "consultation_notes" ("outcome")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_appointment_reminders_appointment_id" ON "appointment_reminders" ("appointment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointment_reminders_status" ON "appointment_reminders" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointment_reminders_scheduled_time" ON "appointment_reminders" ("scheduled_time")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "consultation_notes" DROP CONSTRAINT "FK_consultation_notes_appointment"`,
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_appointment_reminders_scheduled_time"`);
    await queryRunner.query(`DROP INDEX "IDX_appointment_reminders_status"`);
    await queryRunner.query(`DROP INDEX "IDX_appointment_reminders_appointment_id"`);
    await queryRunner.query(`DROP INDEX "IDX_consultation_notes_outcome"`);
    await queryRunner.query(`DROP INDEX "IDX_consultation_notes_doctor_id"`);
    await queryRunner.query(`DROP INDEX "IDX_consultation_notes_appointment_id"`);
    await queryRunner.query(`DROP INDEX "IDX_doctor_availability_status"`);
    await queryRunner.query(`DROP INDEX "IDX_doctor_availability_day_of_week"`);
    await queryRunner.query(`DROP INDEX "IDX_doctor_availability_doctor_id"`);
    await queryRunner.query(`DROP INDEX "IDX_appointments_type"`);
    await queryRunner.query(`DROP INDEX "IDX_appointments_priority"`);
    await queryRunner.query(`DROP INDEX "IDX_appointments_status"`);
    await queryRunner.query(`DROP INDEX "IDX_appointments_date"`);
    await queryRunner.query(`DROP INDEX "IDX_appointments_patient_id"`);
    await queryRunner.query(`DROP INDEX "IDX_appointments_doctor_id"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "appointment_reminders"`);
    await queryRunner.query(`DROP TABLE "consultation_notes"`);
    await queryRunner.query(`DROP TABLE "doctor_availability"`);
    await queryRunner.query(`DROP TABLE "appointments"`);
  }
}
