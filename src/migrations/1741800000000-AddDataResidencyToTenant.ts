import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDataResidencyToTenant1741800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add region column
    await queryRunner.addColumn(
      'tenants',
      new TableColumn({
        name: 'region',
        type: 'varchar',
        length: '50',
        default: "'EU'",
        comment: 'Data residency region for GDPR and compliance requirements',
      }),
    );

    // Add strict data residency enforcement flag
    await queryRunner.addColumn(
      'tenants',
      new TableColumn({
        name: 'strict_data_residency',
        type: 'boolean',
        default: false,
        comment: 'Enforce strict data residency controls',
      }),
    );

    // Add allowed IP ranges
    await queryRunner.addColumn(
      'tenants',
      new TableColumn({
        name: 'allowed_ip_ranges',
        type: 'text',
        isNullable: true,
        comment: 'Allowed client IP ranges for this region',
      }),
    );

    // Create index on region column for faster queries
    await queryRunner.createIndex(
      'tenants',
      {
        name: 'IDX_tenants_region',
        columnNames: ['region'],
      },
    );

    // Create index on strict_data_residency for filtering
    await queryRunner.createIndex(
      'tenants',
      {
        name: 'IDX_tenants_strict_data_residency',
        columnNames: ['strict_data_residency'],
      },
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('tenants', 'IDX_tenants_strict_data_residency');
    await queryRunner.dropIndex('tenants', 'IDX_tenants_region');

    // Drop columns
    await queryRunner.dropColumn('tenants', 'allowed_ip_ranges');
    await queryRunner.dropColumn('tenants', 'strict_data_residency');
    await queryRunner.dropColumn('tenants', 'region');
  }
}
