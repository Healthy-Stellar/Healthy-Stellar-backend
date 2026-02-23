import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAuditLogsTable1740200000000 implements MigrationInterface {
  name = 'CreateAuditLogsTable1740200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create audit_logs table
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'actorId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'action',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'resourceId',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'resourceType',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'patientId',
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
            name: 'userAgent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'stellarTxHash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'integrityHash',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create indexes for common queries
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_actorId_createdAt',
        columnNames: ['actorId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_resourceId_createdAt',
        columnNames: ['resourceId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_resourceType_createdAt',
        columnNames: ['resourceType', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_action_createdAt',
        columnNames: ['action', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_patientId_createdAt',
        columnNames: ['patientId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_createdAt',
        columnNames: ['createdAt'],
      }),
    );

    // Create immutability protection function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_logs_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Allow stellarTxHash update if it's currently NULL
        IF TG_OP = 'UPDATE' AND OLD."stellarTxHash" IS NULL AND NEW."stellarTxHash" IS NOT NULL THEN
          RETURN NEW;
        END IF;
        
        -- Block all other updates and deletes
        RAISE EXCEPTION 'audit_logs rows are append-only. UPDATE and DELETE are not allowed.';
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Attach BEFORE UPDATE trigger
    await queryRunner.query(`
      CREATE TRIGGER trg_audit_logs_no_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
    `);

    // Attach BEFORE DELETE trigger
    await queryRunner.query(`
      CREATE TRIGGER trg_audit_logs_no_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs`);
    
    // Drop function
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_logs_immutable`);
    
    // Drop table (indexes will be dropped automatically)
    await queryRunner.dropTable('audit_logs');
  }
}
