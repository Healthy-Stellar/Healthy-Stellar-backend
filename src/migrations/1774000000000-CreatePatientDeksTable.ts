import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePatientDeksTable1774000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'patient_deks',
        columns: [
          {
            name: 'patient_address',
            type: 'varchar',
            length: '255',
            isPrimary: true,
          },
          {
            name: 'ciphertext',
            type: 'text',
            isNullable: false,
            comment: 'Hex-encoded AES-256-GCM ciphertext of the DEK',
          },
          {
            name: 'iv',
            type: 'varchar',
            length: '24',
            isNullable: false,
            comment: 'Hex-encoded 12-byte GCM IV',
          },
          {
            name: 'auth_tag',
            type: 'varchar',
            length: '32',
            isNullable: false,
            comment: 'Hex-encoded 16-byte GCM auth tag',
          },
          {
            name: 'master_key_version',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'Master key version used to encrypt this DEK',
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
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('patient_deks');
  }
}
