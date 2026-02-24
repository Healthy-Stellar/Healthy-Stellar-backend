import { MigrationInterface, QueryRunner } from 'typeorm';

export class LaboratoryInformationSystem1737600000000 implements MigrationInterface {
  name = 'LaboratoryInformationSystem1737600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Lab Workflows table
    await queryRunner.query(`
            CREATE TABLE "lab_workflows" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "description" text,
                "status" character varying NOT NULL DEFAULT 'pending',
                "priority" character varying NOT NULL DEFAULT 'normal',
                "lab_order_id" uuid NOT NULL,
                "assigned_to" character varying,
                "estimated_duration" integer,
                "actual_duration" integer,
                "started_at" TIMESTAMP,
                "completed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lab_workflows" PRIMARY KEY ("id")
            )
        `);

    // Lab Workflow Steps table
    await queryRunner.query(`
            CREATE TABLE "lab_workflow_steps" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workflow_id" uuid NOT NULL,
                "name" character varying NOT NULL,
                "description" text,
                "type" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'pending',
                "step_order" integer NOT NULL,
                "assigned_to" character varying,
                "equipment_id" character varying,
                "estimated_duration" integer,
                "actual_duration" integer,
                "parameters" json,
                "results" json,
                "notes" text,
                "started_at" TIMESTAMP,
                "completed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lab_workflow_steps" PRIMARY KEY ("id")
            )
        `);

    // Lab Equipment table
    await queryRunner.query(`
            CREATE TABLE "lab_equipment" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "model" character varying NOT NULL,
                "manufacturer" character varying NOT NULL,
                "serial_number" character varying NOT NULL,
                "type" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'active',
                "location" character varying,
                "installation_date" TIMESTAMP,
                "last_maintenance_date" TIMESTAMP,
                "next_maintenance_date" TIMESTAMP,
                "last_calibration_date" TIMESTAMP,
                "next_calibration_date" TIMESTAMP,
                "specifications" json,
                "configuration" json,
                "is_automated" boolean NOT NULL DEFAULT false,
                "supports_lis_integration" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lab_equipment" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_lab_equipment_serial_number" UNIQUE ("serial_number")
            )
        `);

    // Lab Equipment Interfaces table
    await queryRunner.query(`
            CREATE TABLE "lab_equipment_interfaces" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "equipment_id" uuid NOT NULL,
                "name" character varying NOT NULL,
                "type" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'disconnected',
                "connection_string" character varying,
                "configuration" json,
                "last_connection_at" TIMESTAMP,
                "last_data_received_at" TIMESTAMP,
                "message_count" integer NOT NULL DEFAULT 0,
                "error_count" integer NOT NULL DEFAULT 0,
                "last_error_message" character varying,
                "is_bidirectional" boolean NOT NULL DEFAULT false,
                "auto_reconnect" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lab_equipment_interfaces" PRIMARY KEY ("id")
            )
        `);

    // Lab Reference Ranges table
    await queryRunner.query(`
            CREATE TABLE "lab_reference_ranges" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "test_parameter_id" uuid NOT NULL,
                "type" character varying NOT NULL,
                "age_group" character varying NOT NULL DEFAULT 'adult',
                "gender" character varying NOT NULL DEFAULT 'all',
                "min_age" integer,
                "max_age" integer,
                "lower_limit" decimal(10,4),
                "upper_limit" decimal(10,4),
                "text_value" character varying,
                "unit" character varying NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "effective_from" TIMESTAMP NOT NULL,
                "effective_to" TIMESTAMP,
                "notes" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lab_reference_ranges" PRIMARY KEY ("id")
            )
        `);

    // Lab Report Templates table
    await queryRunner.query(`
            CREATE TABLE "lab_report_templates" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "description" text,
                "type" character varying NOT NULL,
                "format" character varying NOT NULL DEFAULT 'pdf',
                "template" text NOT NULL,
                "styles" json,
                "parameters" json,
                "header_template" text,
                "footer_template" text,
                "is_default" boolean NOT NULL DEFAULT false,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lab_report_templates" PRIMARY KEY ("id")
            )
        `);

    // Lab Reports table
    await queryRunner.query(`
            CREATE TABLE "lab_reports" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "template_id" uuid NOT NULL,
                "lab_order_id" uuid,
                "title" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'generating',
                "file_path" character varying,
                "file_size" integer,
                "generated_by" character varying NOT NULL,
                "generated_at" TIMESTAMP,
                "sent_to" character varying,
                "sent_at" TIMESTAMP,
                "parameters" json,
                "notes" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lab_reports" PRIMARY KEY ("id")
            )
        `);

    // Lab Analytics table
    await queryRunner.query(`
            CREATE TABLE "lab_analytics" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "metric_type" character varying NOT NULL,
                "period" character varying NOT NULL,
                "period_start" TIMESTAMP NOT NULL,
                "period_end" TIMESTAMP NOT NULL,
                "metric_value" decimal(10,4) NOT NULL,
                "unit" character varying,
                "department_id" character varying,
                "equipment_id" character varying,
                "test_type" character varying,
                "staff_id" character varying,
                "metadata" json,
                "target_value" decimal(10,4),
                "benchmark_value" decimal(10,4),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lab_analytics" PRIMARY KEY ("id")
            )
        `);

    // Lab Accreditations table
    await queryRunner.query(`
            CREATE TABLE "lab_accreditations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "type" character varying NOT NULL,
                "accreditation_body" character varying NOT NULL,
                "certificate_number" character varying NOT NULL,
                "status" character varying NOT NULL,
                "issued_date" TIMESTAMP NOT NULL,
                "expiry_date" TIMESTAMP NOT NULL,
                "renewal_date" TIMESTAMP,
                "scope_of_accreditation" text NOT NULL,
                "certificate_file_path" character varying,
                "next_assessment_date" TIMESTAMP,
                "assessment_frequency" integer,
                "requirements" json,
                "notes" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lab_accreditations" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_lab_accreditations_certificate_number" UNIQUE ("certificate_number")
            )
        `);

    // Lab Compliance Records table
    await queryRunner.query(`
            CREATE TABLE "lab_compliance_records" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "accreditation_id" uuid NOT NULL,
                "type" character varying NOT NULL,
                "requirement" character varying NOT NULL,
                "description" text NOT NULL,
                "status" character varying NOT NULL,
                "assessment_date" TIMESTAMP NOT NULL,
                "assessed_by" character varying NOT NULL,
                "due_date" TIMESTAMP,
                "completion_date" TIMESTAMP,
                "findings" text,
                "corrective_actions" text,
                "evidence_file_path" character varying,
                "responsible_person" character varying,
                "follow_up_required" boolean NOT NULL DEFAULT false,
                "follow_up_date" TIMESTAMP,
                "metadata" json,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lab_compliance_records" PRIMARY KEY ("id")
            )
        `);

    // Add foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "lab_workflow_steps" 
            ADD CONSTRAINT "FK_lab_workflow_steps_workflow" 
            FOREIGN KEY ("workflow_id") REFERENCES "lab_workflows"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "lab_equipment_interfaces" 
            ADD CONSTRAINT "FK_lab_equipment_interfaces_equipment" 
            FOREIGN KEY ("equipment_id") REFERENCES "lab_equipment"("id") ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "lab_reports" 
            ADD CONSTRAINT "FK_lab_reports_template" 
            FOREIGN KEY ("template_id") REFERENCES "lab_report_templates"("id")
        `);

    await queryRunner.query(`
            ALTER TABLE "lab_compliance_records" 
            ADD CONSTRAINT "FK_lab_compliance_records_accreditation" 
            FOREIGN KEY ("accreditation_id") REFERENCES "lab_accreditations"("id") ON DELETE CASCADE
        `);

    // Create indexes for better performance
    await queryRunner.query(
      `CREATE INDEX "IDX_lab_workflows_status" ON "lab_workflows" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lab_workflows_assigned_to" ON "lab_workflows" ("assigned_to")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lab_workflows_lab_order_id" ON "lab_workflows" ("lab_order_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_lab_equipment_status" ON "lab_equipment" ("status")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_lab_equipment_type" ON "lab_equipment" ("type")`);

    await queryRunner.query(
      `CREATE INDEX "IDX_lab_analytics_metric_type" ON "lab_analytics" ("metric_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lab_analytics_period" ON "lab_analytics" ("period")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lab_analytics_period_start" ON "lab_analytics" ("period_start")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_lab_accreditations_status" ON "lab_accreditations" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lab_accreditations_expiry_date" ON "lab_accreditations" ("expiry_date")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_lab_compliance_records_status" ON "lab_compliance_records" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lab_compliance_records_type" ON "lab_compliance_records" ("type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "lab_compliance_records" DROP CONSTRAINT "FK_lab_compliance_records_accreditation"`,
    );
    await queryRunner.query(`ALTER TABLE "lab_reports" DROP CONSTRAINT "FK_lab_reports_template"`);
    await queryRunner.query(
      `ALTER TABLE "lab_equipment_interfaces" DROP CONSTRAINT "FK_lab_equipment_interfaces_equipment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_workflow_steps" DROP CONSTRAINT "FK_lab_workflow_steps_workflow"`,
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_lab_compliance_records_type"`);
    await queryRunner.query(`DROP INDEX "IDX_lab_compliance_records_status"`);
    await queryRunner.query(`DROP INDEX "IDX_lab_accreditations_expiry_date"`);
    await queryRunner.query(`DROP INDEX "IDX_lab_accreditations_status"`);
    await queryRunner.query(`DROP INDEX "IDX_lab_analytics_period_start"`);
    await queryRunner.query(`DROP INDEX "IDX_lab_analytics_period"`);
    await queryRunner.query(`DROP INDEX "IDX_lab_analytics_metric_type"`);
    await queryRunner.query(`DROP INDEX "IDX_lab_equipment_type"`);
    await queryRunner.query(`DROP INDEX "IDX_lab_equipment_status"`);
    await queryRunner.query(`DROP INDEX "IDX_lab_workflows_lab_order_id"`);
    await queryRunner.query(`DROP INDEX "IDX_lab_workflows_assigned_to"`);
    await queryRunner.query(`DROP INDEX "IDX_lab_workflows_status"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "lab_compliance_records"`);
    await queryRunner.query(`DROP TABLE "lab_accreditations"`);
    await queryRunner.query(`DROP TABLE "lab_analytics"`);
    await queryRunner.query(`DROP TABLE "lab_reports"`);
    await queryRunner.query(`DROP TABLE "lab_report_templates"`);
    await queryRunner.query(`DROP TABLE "lab_reference_ranges"`);
    await queryRunner.query(`DROP TABLE "lab_equipment_interfaces"`);
    await queryRunner.query(`DROP TABLE "lab_equipment"`);
    await queryRunner.query(`DROP TABLE "lab_workflow_steps"`);
    await queryRunner.query(`DROP TABLE "lab_workflows"`);
  }
}
