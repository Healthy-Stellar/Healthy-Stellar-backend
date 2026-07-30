import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddTenantBranding1772900000000 implements MigrationInterface {
  name = 'AddTenantBranding1772900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tenant_branding',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          { name: 'logo_url', type: 'varchar', length: '2048', isNullable: true },
          { name: 'primary_color', type: 'varchar', length: '7', isNullable: true },
          { name: 'secondary_color', type: 'varchar', length: '7', isNullable: true },
          { name: 'custom_domain', type: 'varchar', length: '253', isNullable: true },
          { name: 'support_email', type: 'varchar', length: '254', isNullable: true },
          { name: 'support_phone', type: 'varchar', length: '30', isNullable: true },
          { name: 'organization_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'updated_by', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamp with time zone', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp with time zone', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'tenant_branding',
      new TableIndex({
        name: 'IDX_tenant_branding_tenant_id',
        columnNames: ['tenant_id'],
        isUnique: true,
      }),
    );

    await queryRunner.query(`
      CREATE TRIGGER update_tenant_branding_updated_at
      BEFORE UPDATE ON tenant_branding
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(
      `COMMENT ON TABLE tenant_branding IS 'Per-tenant branding: logo, colors, custom domain, support contact';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS update_tenant_branding_updated_at ON tenant_branding',
    );
    await queryRunner.dropTable('tenant_branding');
  }
}
