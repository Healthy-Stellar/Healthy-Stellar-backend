import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: CreateTenantQuotasTable
 *
 * Adds the `tenant_quotas` table used by TenantQuotaService to persist
 * per-tenant tier assignments and custom limit overrides.
 *
 * Counter values (records used, API calls, etc.) are stored in Redis –
 * this table only holds the *limit* configuration.
 */
export class CreateTenantQuotasTable1716500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tenant_quotas',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenant_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'tier',
            type: 'varchar',
            length: '50',
            default: "'free'",
            isNullable: false,
          },
          {
            name: 'custom_records_per_month',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'custom_storage_bytes',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'custom_api_calls_per_hour',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'custom_bulk_operations_concurrent',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
      true, // ifNotExists
    );

    await queryRunner.createIndex(
      'tenant_quotas',
      new TableIndex({
        name: 'UQ_tenant_quotas_tenant_id',
        columnNames: ['tenant_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tenant_quotas', true);
  }
}