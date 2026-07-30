import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateProviderPatientRelationships1772200000000 implements MigrationInterface {
  name = 'CreateProviderPatientRelationships1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'provider_patient_relationships',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'providerId',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'patientId',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'firstInteractionAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'recordCount',
            type: 'integer',
            default: 1,
          },
        ],
        uniques: [
          {
            name: 'UQ_PPR_PROVIDER_PATIENT',
            columnNames: ['providerId', 'patientId'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'provider_patient_relationships',
      new TableIndex({
        name: 'IDX_PPR_PROVIDER',
        columnNames: ['providerId'],
      }),
    );

    await queryRunner.createIndex(
      'provider_patient_relationships',
      new TableIndex({
        name: 'IDX_PPR_PATIENT',
        columnNames: ['patientId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('provider_patient_relationships');
  }
}
