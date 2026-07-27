import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateReconciliationReportsTable1772700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'reconciliation_reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'discrepancyType',
            type: 'enum',
            enum: [
              'PATIENT_COUNT_MISMATCH',
              'RECORD_COUNT_MISMATCH',
              'MISSING_ONCHAIN_RECORD',
              'EXTRA_CACHED_DATA',
              'PROVIDER_LIST_MISMATCH',
            ],
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['OPEN', 'REPAIRED', 'IRRECONCILABLE'],
            default: "'OPEN'",
          },
          { name: 'patientId', type: 'uuid', isNullable: true },
          { name: 'offChainSnapshot', type: 'jsonb' },
          { name: 'onChainSnapshot', type: 'jsonb' },
          { name: 'repairAction', type: 'text', isNullable: true },
          { name: 'adminNote', type: 'text', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'reconciliation_reports',
      new TableIndex({ name: 'IDX_RECON_STATUS_DATE', columnNames: ['status', 'createdAt'] }),
    );

    await queryRunner.createIndex(
      'reconciliation_reports',
      new TableIndex({
        name: 'IDX_RECON_TYPE_STATUS',
        columnNames: ['discrepancyType', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reconciliation_reports');
  }
}
