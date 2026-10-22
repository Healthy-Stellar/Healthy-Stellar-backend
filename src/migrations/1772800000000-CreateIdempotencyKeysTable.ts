import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateIdempotencyKeysTable1772800000000 implements MigrationInterface {
  name = 'CreateIdempotencyKeysTable1772800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'idempotency_keys',
        columns: [
          { name: 'key', type: 'varchar', length: '255', isPrimary: true },
          { name: 'statusCode', type: 'int', isNullable: false },
          { name: 'responseBody', type: 'text', isNullable: false },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'expiresAt', type: 'timestamp', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'idempotency_keys',
      new Index({ columnNames: ['expiresAt'] } as any),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('idempotency_keys');
  }
}
