import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Creates the `audit_log` table with:
 *  - Required fields: id, actorAddress, action, targetAddress, resourceType,
 *    resourceId, ipAddress, timestamp, metadata (jsonb)
 *  - Indexes on actorAddress and timestamp for query performance
 *  - Append-only enforcement via BEFORE UPDATE/DELETE triggers
 */
export class CreateAuditLogTable1772500000000 implements MigrationInterface {
  name = 'CreateAuditLogTable1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'audit_log',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'actorAddress',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'action',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'targetAddress',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'resourceType',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'resourceId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'timestamp',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            default: "'{}'",
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'audit_log',
      new TableIndex({
        name: 'idx_audit_log_actor',
        columnNames: ['actorAddress'],
      }),
    );

    await queryRunner.createIndex(
      'audit_log',
      new TableIndex({
        name: 'idx_audit_log_timestamp',
        columnNames: ['timestamp'],
      }),
    );

    await queryRunner.createIndex(
      'audit_log',
      new TableIndex({
        name: 'idx_audit_log_actor_timestamp',
        columnNames: ['actorAddress', 'timestamp'],
      }),
    );

    // Append-only enforcement: block UPDATE and DELETE at DB level
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_log_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log rows are append-only. UPDATE and DELETE are not permitted.';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log;
      CREATE TRIGGER trg_audit_log_no_update
      BEFORE UPDATE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_log;
      CREATE TRIGGER trg_audit_log_no_delete
      BEFORE DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_log`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_log_immutable`);
    await queryRunner.dropTable('audit_log', true);
  }
}
