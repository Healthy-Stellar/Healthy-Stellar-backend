import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTenantConfigTable1740000000000 implements MigrationInterface {
  name = 'CreateTenantConfigTable1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tenant_configs table
    await queryRunner.createTable(
      new Table({
        name: 'tenant_configs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'key',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'value',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'value_type',
            type: 'varchar',
            length: '50',
            default: "'string'",
            comment: 'Data type: string, number, boolean, json, array',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_sensitive',
            type: 'boolean',
            default: false,
            comment: 'Whether this config contains sensitive data',
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_by',
            type: 'uuid',
            isNullable: true,
            comment: 'User ID who last updated this config',
          },
        ],
      }),
      true,
    );

    // Create unique constraint on tenant_id + key
    await queryRunner.createIndex(
      'tenant_configs',
      new TableIndex({
        name: 'IDX_tenant_configs_tenant_key',
        columnNames: ['tenant_id', 'key'],
        isUnique: true,
      }),
    );

    // Create index on tenant_id for faster lookups
    await queryRunner.createIndex(
      'tenant_configs',
      new TableIndex({
        name: 'IDX_tenant_configs_tenant_id',
        columnNames: ['tenant_id'],
      }),
    );

    // Create index on key for global config lookups
    await queryRunner.createIndex(
      'tenant_configs',
      new TableIndex({
        name: 'IDX_tenant_configs_key',
        columnNames: ['key'],
      }),
    );

    // Add trigger for updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_tenant_configs_updated_at
      BEFORE UPDATE ON tenant_configs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Add audit trigger for tenant config changes
    await queryRunner.query(`
      CREATE TRIGGER tenant_configs_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON tenant_configs
      FOR EACH ROW
      EXECUTE FUNCTION audit_trigger_function();
    `);

    // Add comments for HIPAA compliance documentation
    await queryRunner.query(`
      COMMENT ON TABLE tenant_configs IS 'Per-tenant configuration storage with audit trail for HIPAA compliance';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN tenant_configs.tenant_id IS 'Reference to tenant/organization';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN tenant_configs.key IS 'Configuration key (e.g., audit_retention_days, fhir_export_enabled)';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN tenant_configs.value IS 'Configuration value stored as text, parsed based on value_type';
    `);

    // Insert default supported config keys documentation
    await queryRunner.query(`
      INSERT INTO tenant_configs (tenant_id, key, value, value_type, description, is_sensitive)
      VALUES 
        ('00000000-0000-0000-0000-000000000000', 'audit_retention_days', '2555', 'number', 'Number of days to retain audit logs (HIPAA: 7 years = 2555 days)', false),
        ('00000000-0000-0000-0000-000000000000', 'max_record_size_mb', '50', 'number', 'Maximum size of medical records in megabytes', false),
        ('00000000-0000-0000-0000-000000000000', 'emergency_access_enabled', 'true', 'boolean', 'Enable emergency access override for critical situations', false),
        ('00000000-0000-0000-0000-000000000000', 'fhir_export_enabled', 'true', 'boolean', 'Enable FHIR export functionality', false),
        ('00000000-0000-0000-0000-000000000000', 'allowed_record_types', '["medical_record","lab_result","prescription","imaging","consultation"]', 'json', 'List of allowed medical record types', false)
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS tenant_configs_audit_trigger ON tenant_configs');
    await queryRunner.query('DROP TRIGGER IF EXISTS update_tenant_configs_updated_at ON tenant_configs');
    await queryRunner.dropTable('tenant_configs');
  }
}
