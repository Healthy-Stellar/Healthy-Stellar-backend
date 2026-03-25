import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateMedicalRecordsTable1741300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'medical_records',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'patient_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'ipfs_cid',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'encrypted_dek',
            type: 'bytea',
            isNullable: false,
          },
          {
            name: 'iv',
            type: 'bytea',
            isNullable: false,
          },
          {
            name: 'auth_tag',
            type: 'bytea',
            isNullable: false,
          },
          {
            name: 'dek_version',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          {
            name: 'IDX_MEDICAL_RECORDS_PATIENT_ID',
            columnNames: ['patient_id'],
          },
          {
            name: 'IDX_MEDICAL_RECORDS_IPFS_CID',
            columnNames: ['ipfs_cid'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('medical_records');
  }
}
