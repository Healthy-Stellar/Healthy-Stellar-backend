import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the policies table for the unified role-permission policy engine.
 * This enables flexible authorization policies beyond simple role checks.
 */
export class CreatePoliciesTable1775400000000 implements MigrationInterface {
  name = 'CreatePoliciesTable1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create policies table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS policies (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "description" varchar(500) NULL,
        "effect" varchar(10) NOT NULL DEFAULT 'allow',
        "subjects" jsonb NULL,
        "resources" jsonb NULL,
        "actions" jsonb NULL,
        "conditions" jsonb NULL,
        "priority" int NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "category" varchar(255) NULL,
        "metadata" jsonb NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policies" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policies_name" UNIQUE ("name")
      )
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_name" ON policies ("name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_category" ON policies ("category")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_effect_priority" ON policies ("effect", "priority" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_active_priority" ON policies ("isActive", "priority" DESC)
    `);

    // Add Row Level Security if using PostgreSQL
    await queryRunner.query(`
      ALTER TABLE policies ENABLE ROW LEVEL SECURITY
    `);

    // Create RLS policy for policies table
    await queryRunner.query(`
      CREATE POLICY policies_read_policy ON policies
      FOR SELECT USING (true)
    `);

    await queryRunner.query(`
      CREATE POLICY policies_write_policy ON policies
      FOR ALL USING (
        current_setting('app.current_user_role', true) IN ('admin', 'super_admin')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop RLS policies
    await queryRunner.query(`DROP POLICY IF EXISTS policies_write_policy ON policies`);
    await queryRunner.query(`DROP POLICY IF EXISTS policies_read_policy ON policies`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_policies_active_priority"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_policies_effect_priority"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_policies_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_policies_name"`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS policies`);
  }
}
