import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Creates the `sessions` table used by the auth module and adds a
 * covering index on `expires_at` so the cleanup job's range-scan is O(log n)
 * rather than O(n).
 */
export class CreateSessionsTable1700000000000 implements MigrationInterface {
  name = 'CreateSessionsTable1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'refresh_token',
            type: 'varchar',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'revoked',
            type: 'boolean',
            default: false,
          },
        ],
      }),
      true,
    );

    // Index that makes the cleanup query fast.
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'idx_sessions_expires_at',
        columnNames: ['expires_at'],
      }),
    );

    // Secondary index so per-user session lookups are also fast.
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'idx_sessions_user_id',
        columnNames: ['user_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('sessions', 'idx_sessions_user_id');
    await queryRunner.dropIndex('sessions', 'idx_sessions_expires_at');
    await queryRunner.dropTable('sessions');
  }
}