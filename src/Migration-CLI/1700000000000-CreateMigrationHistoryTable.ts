import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateMigrationHistoryTable1700000000000
  implements MigrationInterface
{
  name = 'CreateMigrationHistoryTable1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type
    await queryRunner.query(`
      CREATE TYPE "migration_status_enum" AS ENUM (
        'pending', 'executed', 'failed', 'reverted'
      )
    `);

    await queryRunner.createTable(
      new Table({
        name: 'migration_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'migration_name',
            type: 'varchar',
            length: '512',
            isNullable: false,
          },
          {
            name: 'executed_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'executed_by',
            type: 'varchar',
            length: '256',
            isNullable: true,
          },
          {
            name: 'duration_ms',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'executed', 'failed', 'reverted'],
            enumName: 'migration_status_enum',
            default: `'pending'`,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'checksum',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'dry_run',
            type: 'boolean',
            default: false,
          },
          {
            name: 'reverted_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'reverted_by',
            type: 'varchar',
            length: '256',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'migration_history',
      new TableIndex({
        name: 'IDX_migration_history_name_status',
        columnNames: ['migration_name', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'migration_history',
      new TableIndex({
        name: 'IDX_migration_history_executed_at',
        columnNames: ['executed_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'migration_history',
      'IDX_migration_history_executed_at',
    );
    await queryRunner.dropIndex(
      'migration_history',
      'IDX_migration_history_name_status',
    );
    await queryRunner.dropTable('migration_history');
    await queryRunner.query(`DROP TYPE IF EXISTS "migration_status_enum"`);
  }
}
