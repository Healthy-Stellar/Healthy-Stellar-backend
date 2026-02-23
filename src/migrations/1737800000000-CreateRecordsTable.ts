import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateRecordsTable1737800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'records',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'patientId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'cid',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'stellarTxHash',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'recordType',
            type: 'enum',
            enum: [
              'MEDICAL_REPORT',
              'LAB_RESULT',
              'PRESCRIPTION',
              'IMAGING',
              'CONSULTATION',
            ],
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          {
            name: 'IDX_RECORDS_PATIENT_ID',
            columnNames: ['patientId'],
          },
          {
            name: 'IDX_RECORDS_CID',
            columnNames: ['cid'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('records');
  }
}
