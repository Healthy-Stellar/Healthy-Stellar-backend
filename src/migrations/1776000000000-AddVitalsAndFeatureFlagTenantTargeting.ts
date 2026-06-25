import { MigrationInterface, QueryRunner, Table, TableIndex, TableColumn } from 'typeorm';

export class AddVitalsAndFeatureFlagTenantTargeting1776000000000
  implements MigrationInterface
{
  name = 'AddVitalsAndFeatureFlagTenantTargeting1776000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // patient_vitals table
    await queryRunner.createTable(
      new Table({
        name: 'patient_vitals',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'patientId', type: 'uuid', isNullable: false },
          { name: 'tenantId', type: 'uuid', isNullable: true },
          { name: 'heartRate', type: 'decimal', precision: 6, scale: 2, isNullable: true },
          { name: 'systolicBp', type: 'decimal', precision: 6, scale: 2, isNullable: true },
          { name: 'diastolicBp', type: 'decimal', precision: 6, scale: 2, isNullable: true },
          { name: 'oxygenSaturation', type: 'decimal', precision: 5, scale: 2, isNullable: true },
          { name: 'temperature', type: 'decimal', precision: 5, scale: 2, isNullable: true },
          { name: 'respiratoryRate', type: 'decimal', precision: 5, scale: 2, isNullable: true },
          { name: 'bloodGlucose', type: 'decimal', precision: 6, scale: 2, isNullable: true },
          { name: 'recordedBy', type: 'uuid', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'recordedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'patient_vitals',
      new TableIndex({ columnNames: ['patientId', 'recordedAt'] }),
    );

    await queryRunner.createIndex(
      'patient_vitals',
      new TableIndex({ columnNames: ['tenantId', 'patientId', 'recordedAt'] }),
    );

    // feature_flags: add tenant targeting columns and new enum values
    await queryRunner.addColumns('feature_flags', [
      new TableColumn({
        name: 'tenantRolloutPercentage',
        type: 'int',
        default: 0,
      }),
      new TableColumn({
        name: 'tenantAllowlist',
        type: 'text',
        isNullable: true,
        comment: 'Comma-separated tenant IDs for TENANT_ALLOWLIST / TENANT_PERCENTAGE strategies',
      }),
    ]);

    // Extend the strategy enum with new values
    await queryRunner.query(`
      ALTER TYPE feature_flags_strategy_enum
      ADD VALUE IF NOT EXISTS 'TENANT_ALLOWLIST';
    `);
    await queryRunner.query(`
      ALTER TYPE feature_flags_strategy_enum
      ADD VALUE IF NOT EXISTS 'TENANT_PERCENTAGE';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('feature_flags', ['tenantRolloutPercentage', 'tenantAllowlist']);
    await queryRunner.dropTable('patient_vitals', true);
    // Note: Postgres does not support removing enum values; a full type recreation would be needed.
  }
}
