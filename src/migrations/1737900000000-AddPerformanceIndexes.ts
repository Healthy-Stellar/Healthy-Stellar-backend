import { MigrationInterface, QueryRunner } from 'typeorm';

type ColumnOptions = string[][];

export class AddPerformanceIndexes1737900000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1737900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createIndexIfPossible(
      queryRunner,
      'medical_records',
      'IDX_medical_records_patient_id',
      [['patient_id', 'patientId']],
    );
    await this.createIndexIfPossible(
      queryRunner,
      'medical_records',
      'IDX_medical_records_patient_type_status_date',
      [['patient_id', 'patientId'], ['record_type', 'recordType'], ['status'], ['created_at', 'createdAt']],
    );
    await this.createIndexIfPossible(
      queryRunner,
      'medical_records',
      'IDX_medical_records_status_record_type',
      [['status'], ['record_type', 'recordType']],
    );

    await this.createIndexIfPossible(
      queryRunner,
      'access_grants',
      'IDX_access_grants_patient_grantee_expires',
      [['patient_id', 'patientId'], ['grantee_id', 'granteeId'], ['expires_at', 'expiresAt']],
    );
    await this.createIndexIfPossible(
      queryRunner,
      'access_grants',
      'IDX_access_grants_grantee_status_expires',
      [['grantee_id', 'granteeId'], ['status'], ['expires_at', 'expiresAt']],
    );
    await this.createIndexIfPossible(
      queryRunner,
      'access_grants',
      'IDX_access_grants_status_expires',
      [['status'], ['expires_at', 'expiresAt']],
    );

    await this.createIndexIfPossible(
      queryRunner,
      'audit_logs',
      'IDX_audit_logs_user_id_timestamp',
      [['user_id', 'userId'], ['timestamp', 'createdAt']],
    );
    await this.createIndexIfPossible(
      queryRunner,
      'audit_logs',
      'IDX_audit_logs_entity_id',
      [['entity_id', 'entityId']],
    );
    await this.createIndexIfPossible(
      queryRunner,
      'audit_logs',
      'IDX_audit_logs_operation_timestamp',
      [['operation', 'action'], ['timestamp', 'createdAt']],
    );
    await this.createIndexIfPossible(
      queryRunner,
      'audit_logs',
      'IDX_audit_logs_entity_type_id_timestamp',
      [['entity_type', 'entity'], ['entity_id', 'entityId'], ['timestamp', 'createdAt']],
    );

    await this.createIndexIfPossible(
      queryRunner,
      'medical_history',
      'IDX_medical_history_patient_event_date',
      [['patient_id', 'patientId'], ['event_date', 'eventDate']],
    );
    await this.createIndexIfPossible(
      queryRunner,
      'medical_history',
      'IDX_medical_history_record_event_date',
      [['medical_record_id', 'medicalRecordId'], ['event_date', 'eventDate']],
    );

    const analyzableTables = ['medical_records', 'access_grants', 'audit_logs', 'medical_history'];
    for (const table of analyzableTables) {
      if (await this.tableExists(queryRunner, table)) {
        await queryRunner.query(`ANALYZE "${table}"`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const indexes = [
      'IDX_medical_history_record_event_date',
      'IDX_medical_history_patient_event_date',
      'IDX_audit_logs_entity_type_id_timestamp',
      'IDX_audit_logs_operation_timestamp',
      'IDX_audit_logs_entity_id',
      'IDX_audit_logs_user_id_timestamp',
      'IDX_access_grants_status_expires',
      'IDX_access_grants_grantee_status_expires',
      'IDX_access_grants_patient_grantee_expires',
      'IDX_medical_records_status_record_type',
      'IDX_medical_records_patient_type_status_date',
      'IDX_medical_records_patient_id',
    ];

    for (const indexName of indexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${indexName}"`);
    }
  }

  private async createIndexIfPossible(
    queryRunner: QueryRunner,
    table: string,
    indexName: string,
    columnOptions: ColumnOptions,
  ): Promise<void> {
    const resolvedColumns = await this.resolveColumns(queryRunner, table, columnOptions);
    if (!resolvedColumns) {
      return;
    }

    const columnSql = resolvedColumns.map((column) => `"${column}"`).join(', ');
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${table}" (${columnSql})`);
  }

  private async resolveColumns(
    queryRunner: QueryRunner,
    table: string,
    columnOptions: ColumnOptions,
  ): Promise<string[] | null> {
    if (!(await this.tableExists(queryRunner, table))) {
      return null;
    }

    const rows: Array<{ column_name: string }> = await queryRunner.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `,
      [table],
    );
    const existingColumns = new Set(rows.map((row) => row.column_name));
    const resolvedColumns: string[] = [];

    for (const group of columnOptions) {
      const selected = group.find((column) => existingColumns.has(column));
      if (!selected) {
        return null;
      }
      resolvedColumns.push(selected);
    }

    return resolvedColumns;
  }

  private async tableExists(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const result: Array<{ exists: boolean }> = await queryRunner.query(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      [`public.${table}`],
    );
    return Boolean(result[0]?.exists);
  }
}
