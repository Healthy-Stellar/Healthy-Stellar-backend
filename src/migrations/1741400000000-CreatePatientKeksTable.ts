import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePatientKeksTable1741400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'patient_keks',
        columns: [
          {
            name: 'patient_id',
            type: 'varchar',
            length: '255',
            isPrimary: true,
          },
          {
            name: 'kek_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'kek_version',
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
            name: 'rotated_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'IDX_PATIENT_KEKS_KEK_ID',
            columnNames: ['kek_id'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('patient_keks');
  }
}
