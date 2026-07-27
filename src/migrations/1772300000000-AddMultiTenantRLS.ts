import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiTenantRLS1772300000000 implements MigrationInterface {
  name = 'AddMultiTenantRLS1772300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add organizationId to users if not present
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "organizationId" uuid REFERENCES tenants(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_organizationId" ON users ("organizationId");
    `);

    // Add organizationId to medical_records if not present
    await queryRunner.query(`
      ALTER TABLE medical_records
      ADD COLUMN IF NOT EXISTS "organizationId" uuid REFERENCES tenants(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_medical_records_organizationId" ON medical_records ("organizationId");
    `);

    // Add organizationId to access_grants
    await queryRunner.query(`
      ALTER TABLE access_grants
      ADD COLUMN IF NOT EXISTS "organizationId" uuid REFERENCES tenants(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_access_grants_organizationId" ON access_grants ("organizationId");
    `);

    // Add organizationId to audit_logs
    await queryRunner.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS "organizationId" uuid REFERENCES tenants(id) ON DELETE SET NULL;
    `);

    // Create a DB function to get current tenant from session variable
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
        SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
      $$ LANGUAGE sql STABLE;
    `);

    // Enable RLS on medical_records and enforce tenant isolation
    await queryRunner.query(`ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE medical_records FORCE ROW LEVEL SECURITY;`);

    // Drop any existing permissive policies first
    await queryRunner.query(`
      DROP POLICY IF EXISTS medical_records_tenant_isolation ON medical_records;
    `);
    await queryRunner.query(`
      CREATE POLICY medical_records_tenant_isolation ON medical_records
      USING ("organizationId" = current_tenant_id())
      WITH CHECK ("organizationId" = current_tenant_id());
    `);

    // Enable RLS on access_grants
    await queryRunner.query(`ALTER TABLE access_grants ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE access_grants FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      DROP POLICY IF EXISTS access_grants_tenant_isolation ON access_grants;
    `);
    await queryRunner.query(`
      CREATE POLICY access_grants_tenant_isolation ON access_grants
      USING ("organizationId" = current_tenant_id())
      WITH CHECK ("organizationId" = current_tenant_id());
    `);

    // Audit logs: tenants can only read their own logs
    await queryRunner.query(`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`DROP POLICY IF EXISTS audit_logs_read_policy ON audit_logs;`);
    await queryRunner.query(`DROP POLICY IF EXISTS audit_logs_insert_policy ON audit_logs;`);
    await queryRunner.query(`
      CREATE POLICY audit_logs_tenant_isolation ON audit_logs
      USING ("organizationId" = current_tenant_id() OR "organizationId" IS NULL)
      WITH CHECK (true);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs`);
    await queryRunner.query(`DROP POLICY IF EXISTS access_grants_tenant_isolation ON access_grants`);
    await queryRunner.query(`DROP POLICY IF EXISTS medical_records_tenant_isolation ON medical_records`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS current_tenant_id()`);

    await queryRunner.query(`ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE access_grants DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE medical_records DISABLE ROW LEVEL SECURITY`);

    await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS "organizationId"`);
    await queryRunner.query(`ALTER TABLE access_grants DROP COLUMN IF EXISTS "organizationId"`);
    await queryRunner.query(`ALTER TABLE medical_records DROP COLUMN IF EXISTS "organizationId"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "organizationId"`);
  }
}
