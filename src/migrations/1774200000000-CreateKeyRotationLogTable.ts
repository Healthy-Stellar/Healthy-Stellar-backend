import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateKeyRotationLogTable1774200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'key_rotation_log',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'old_key_version', type: 'varchar', length: '50' },
          { name: 'new_key_version', type: 'varchar', length: '50' },
          { name: 'reencrypted_count', type: 'int', default: '0' },
          { name: 'operator_id', type: 'varchar', length: '255' },
          { name: 'phase', type: 'varchar', length: '20' },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'started_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'completed_at', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('key_rotation_log');
  }
}
