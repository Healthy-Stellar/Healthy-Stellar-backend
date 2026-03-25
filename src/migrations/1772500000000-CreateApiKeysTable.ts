import { MigrationInterface, QueryRunner, Table, Index, ForeignKey } from 'typeorm';

export class CreateApiKeysTable1772500000000 implements MigrationInterface {
  name = 'CreateApiKeysTable1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'api_keys',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'key_hash',
            type: 'varchar',
            length: '64',
            isUnique: true,
          },
          {
            name: 'scopes',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'last_used_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'last_used_by_ip',
            type: 'inet',
            isNullable: true,
          },
          {
            name: 'created_by_id',
            type: 'uuid',
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
        ],
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'api_keys',
      new Index('IDX_api_keys_key_hash', ['key_hash']),
    );

    await queryRunner.createIndex(
      'api_keys',
      new Index('IDX_api_keys_created_by_id', ['created_by_id']),
    );

    await queryRunner.createIndex(
      'api_keys',
      new Index('IDX_api_keys_is_active', ['is_active']),
    );

    // Create foreign key
    await queryRunner.createForeignKey(
      'api_keys',
      new ForeignKey({
        columnNames: ['created_by_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    const table = await queryRunner.getTable('api_keys');
    const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('created_by_id') !== -1);
    if (foreignKey) {
      await queryRunner.dropForeignKey('api_keys', foreignKey);
    }

    // Drop indexes
    await queryRunner.dropIndex('api_keys', 'IDX_api_keys_is_active');
    await queryRunner.dropIndex('api_keys', 'IDX_api_keys_created_by_id');
    await queryRunner.dropIndex('api_keys', 'IDX_api_keys_key_hash');

    // Drop table
    await queryRunner.dropTable('api_keys');
  }
}