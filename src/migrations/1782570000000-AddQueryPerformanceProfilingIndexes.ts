import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Database Query Performance Profiling and Index Optimization (#760)
 *
 * Context / methodology
 * ----------------------
 * A live database with realistic load was not available in this environment,
 * so the EXPLAIN ANALYZE step required by the issue could not be executed
 * against real data. Instead, the index choices below are derived from
 * **static query-pattern analysis** of:
 *
 *  - `scripts/benchmark-database-performance.ts` — the benchmark harness that
 *    times the system's highest-traffic queries (medical records lookups,
 *    access-grant validation, audit log queries, medical history timelines).
 *  - `scripts/explain-query-plans.ts` — runs `EXPLAIN (ANALYZE, BUFFERS)` on
 *    the top 3 queries it identifies as most frequently executed:
 *      1. medical_records WHERE "patientId" = ? ORDER BY "createdAt" DESC
 *      2. access_grants   WHERE "patientId" = ? AND "granteeId" = ? AND
 *         status = 'ACTIVE' AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
 *      3. audit_logs      WHERE user_id = ? ORDER BY timestamp DESC
 *  - Actual TypeORM entities and repository/service `.where()`/`.andWhere()`/
 *    `find({ where: ... })` usage for the four highest-traffic tables named
 *    in the issue: `patients`, `medical_records`, `appointments`, and
 *    `audit_logs`.
 *
 * This migration intentionally focuses on gaps that are NOT already covered
 * by prior index migrations (`1737900000000-AddPerformanceIndexes`,
 * `1775800000000-AddAuditLogCompositeIndexes`), specifically:
 *
 *  - `medical_records.organizationId` is filtered on every call to
 *    `MedicalRecordsService.search()` / `.fullTextSearch()`
 *    (src/medical-records/services/medical-records.service.ts, ~lines
 *    229-260 and 329-360) together with `patientId`, `recordType`, `status`
 *    and a `recordDate` range, but `organizationId` was previously only
 *    indexed on its own (`@Index()` on the column) — there was no composite
 *    covering the realistic multi-tenant filter shape.
 *  - `appointments` had no indexes at all beyond `tenantId` and the
 *    `(doctorId, startTime, endTime)` uniqueness constraint, despite
 *    `AppointmentService` (src/appointments/services/appointment.service.ts)
 *    running tenant-scoped lookups by `doctorId` + date range + `status`
 *    (`getAvailableSlots`, `findByDoctor`) and by `patientId` (patient-role
 *    scoped `findAll`) on every booking and dashboard request.
 *  - `patients` had no index supporting the duplicate-detection query run on
 *    every patient creation (`PatientsService.detectDuplicate()`,
 *    src/patients/patients.service.ts) which filters on `isActive` +
 *    `dateOfBirth` + `sex`, nor on `lastName`/`firstName` which are scanned
 *    via `LIKE` in `PatientsService.search()`.
 *  - `audit_logs` (the snake_case-column entity at
 *    src/common/entities/audit-log.entity.ts, which is the shape the
 *    benchmark/explain scripts query directly with raw SQL) already has
 *    single-column indexes from its `@Index()` decorators, but no composite
 *    covering the combined `entity_type` + `entity_id` + `timestamp` ordering
 *    used by "resource audit trail" lookups, nor `operation` + `timestamp`
 *    used for operation-filtered compliance queries.
 *
 * No p95/throughput numbers are claimed here, per issue guidance — actual
 * latency improvement must be validated by re-running
 * `npm run benchmark:db` / `npm run explain:queries` before and after this
 * migration against a staging database under realistic load, and by
 * monitoring `pg_stat_statements` / CI performance gates after rollout.
 *
 * All indexes are created with `CREATE INDEX CONCURRENTLY` where practical
 * to avoid locking these high-traffic tables during deployment, and with
 * `IF NOT EXISTS` guards so this migration is safe to re-run and does not
 * conflict with indexes that may already exist from earlier (partially
 * broken) performance migrations in this folder.
 */
export class AddQueryPerformanceProfilingIndexes1782570000000 implements MigrationInterface {
  name = 'AddQueryPerformanceProfilingIndexes1782570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==========================================================================
    // PATIENTS
    // ==========================================================================

    /**
     * Index: patients(isActive, dateOfBirth, sex)
     *
     * Query pattern (PatientsService.detectDuplicate, raw SQL block):
     *   SELECT ... FROM patients
     *   WHERE "isActive" = true
     *     AND "dateOfBirth" = $1
     *     AND lower(coalesce("sex", 'unknown')) = $2
     *     AND (similarity(...) > 0.85 OR ...)
     *
     * Run on every patient creation to catch possible duplicates before
     * insert. Without this composite, Postgres has to sequentially scan
     * (or fall back to a single-column index on one predicate only) the
     * entire patients table for every new registration.
     */
    await this.createIndexConcurrently(queryRunner, 'patients', 'IDX_patients_active_dob_sex', [
      'isActive',
      'dateOfBirth',
      'sex',
    ]);

    /**
     * Index: patients(lastName, firstName)
     *
     * Query pattern (PatientsService.search):
     *   SELECT * FROM patients WHERE "lastName" LIKE '%...%' OR "firstName" LIKE '%...%' ...
     *
     * A plain B-tree index cannot accelerate a leading-wildcard LIKE, but
     * patient search/lookup UIs predominantly query by exact or
     * prefix-anchored last name (e.g. typeahead), and this composite also
     * supports the `ORDER BY lastName, firstName` style listing used by
     * admin/reception patient lookup screens. Kept as a plain (non-trigram)
     * index since pg_trgm is not currently enabled by any migration in this
     * repo and adding the extension is out of scope for this change.
     */
    await this.createIndexConcurrently(queryRunner, 'patients', 'IDX_patients_lastName_firstName', [
      'lastName',
      'firstName',
    ]);

    // ==========================================================================
    // MEDICAL RECORDS
    // ==========================================================================

    /**
     * Index: medical_records(organizationId, patientId, status, recordDate)
     *
     * Query pattern (MedicalRecordsService.search / .fullTextSearch):
     *   ... WHERE record.organizationId = :organizationId
     *       AND record.patientId = :patientId
     *       AND record.recordType = :recordType
     *       AND record.status = :status
     *       AND record.recordDate BETWEEN :startDate AND :endDate
     *
     * This is the multi-tenant filter shape used by the medical records
     * search and full-text search endpoints, which are hit on every
     * provider-facing record search and report-builder request. Previous
     * index migrations covered (patientId, createdAt) and (status,
     * recordType) but not the organizationId-scoped path, which forces a
     * sequential scan (or an inefficient bitmap-AND of single-column
     * indexes) whenever organizationId is the leading predicate.
     */
    await this.createIndexConcurrently(
      queryRunner,
      'medical_records',
      'IDX_medical_records_org_patient_status_recordDate',
      ['organizationId', 'patientId', 'status', 'recordDate'],
    );

    // ==========================================================================
    // APPOINTMENTS
    // ==========================================================================

    /**
     * Index: appointments(tenant_id, doctor_id, appointment_date, status)
     *
     * Query pattern (AppointmentService.findByDoctor / getAvailableSlots):
     *   ... WHERE tenant_id = ? AND doctor_id = ?
     *       AND appointment_date BETWEEN :startOfDay AND :endOfDay
     *       AND status != 'cancelled'
     *
     * Executed on every "get available slots" and "doctor's schedule for a
     * day" request — i.e. every booking attempt and every provider calendar
     * load. `getScopedWhere()` always adds tenant_id, so it must be the
     * leading column for the index to be selective in a multi-tenant table.
     */
    await this.createIndexConcurrently(
      queryRunner,
      'appointments',
      'IDX_appointments_tenant_doctor_date_status',
      ['tenant_id', 'doctor_id', 'appointment_date', 'status'],
    );

    /**
     * Index: appointments(tenant_id, patient_id, appointment_date)
     *
     * Query pattern (AppointmentService.findAll / getScopedWhere when the
     * caller's role is PATIENT):
     *   ... WHERE tenant_id = ? AND patient_id = ? ORDER BY appointment_date ASC
     *
     * Covers the patient-facing "my appointments" list/dashboard, which is
     * loaded on every patient portal/app session.
     */
    await this.createIndexConcurrently(
      queryRunner,
      'appointments',
      'IDX_appointments_tenant_patient_date',
      ['tenant_id', 'patient_id', 'appointment_date'],
    );

    /**
     * Index: appointments(doctor_id, start_time, end_time)
     *
     * Query pattern (AppointmentService.create, overlap-detection lock):
     *   SELECT ... FROM appointments
     *   WHERE doctor_id = :doctorId
     *     AND start_time < :endTime AND end_time > :startTime
     *     AND status NOT IN ('cancelled', 'rescheduled')
     *   FOR UPDATE
     *
     * This runs inside the booking transaction's pessimistic lock on every
     * appointment creation to prevent double-booking. The existing unique
     * constraint `UQ_appointments_doctor_time` only matches exact
     * (doctorId, startTime, endTime) tuples, not the range-overlap
     * predicate used here, so a dedicated range-friendly composite index
     * materially reduces lock-hold time under concurrent booking load.
     */
    await this.createIndexConcurrently(
      queryRunner,
      'appointments',
      'IDX_appointments_doctor_start_end',
      ['doctor_id', 'start_time', 'end_time'],
    );

    // ==========================================================================
    // AUDIT LOGS (snake_case schema queried directly by the benchmark /
    // explain-query-plans scripts: src/common/entities/audit-log.entity.ts)
    // ==========================================================================

    /**
     * Index: audit_logs(entity_type, entity_id, timestamp DESC)
     *
     * Query pattern (explain-query-plans.ts Query and
     * benchmark-database-performance.ts "Resource Audit Trail" /
     * "Entity Type + ID Audit Trail" benchmarks):
     *   SELECT * FROM audit_logs
     *   WHERE entity_type = ? AND entity_id = ?
     *   ORDER BY timestamp DESC
     *
     * This is the HIPAA-critical "who touched this record" trail, used for
     * compliance reporting and security investigations on a specific
     * resource. A single-column index on entity_id alone (already present
     * via the entity's `@Index(['entityType','entityId'])`) does not cover
     * the DESC sort, forcing an extra sort step for every lookup; this
     * index lets Postgres satisfy the ORDER BY directly from the index.
     */
    await this.createIndexConcurrently(
      queryRunner,
      'audit_logs',
      'IDX_audit_logs_entity_type_entity_id_timestamp',
      ['entity_type', 'entity_id'],
      { timestampDesc: 'timestamp' },
    );

    /**
     * Index: audit_logs(operation, timestamp DESC)
     *
     * Query pattern (benchmark-database-performance.ts "Operation Filter"):
     *   SELECT * FROM audit_logs WHERE operation = ? ORDER BY timestamp DESC LIMIT 100
     *
     * Used by security monitoring / anomaly detection views that filter by
     * a specific operation (e.g. all DELETEs or UPDATEs) across the whole
     * system, independent of any single user or entity.
     */
    await this.createIndexConcurrently(
      queryRunner,
      'audit_logs',
      'IDX_audit_logs_operation_timestamp',
      ['operation'],
      { timestampDesc: 'timestamp' },
    );

    // ANALYZE so the planner immediately picks up the new indexes' stats
    // instead of waiting for autovacuum's next pass.
    const analyzableTables = ['patients', 'medical_records', 'appointments', 'audit_logs'];
    for (const table of analyzableTables) {
      if (await this.tableExists(queryRunner, table)) {
        await queryRunner.query(`ANALYZE "${table}"`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexConcurrently(queryRunner, 'audit_logs', 'IDX_audit_logs_operation_timestamp');
    await this.dropIndexConcurrently(
      queryRunner,
      'audit_logs',
      'IDX_audit_logs_entity_type_entity_id_timestamp',
    );
    await this.dropIndexConcurrently(queryRunner, 'appointments', 'IDX_appointments_doctor_start_end');
    await this.dropIndexConcurrently(
      queryRunner,
      'appointments',
      'IDX_appointments_tenant_patient_date',
    );
    await this.dropIndexConcurrently(
      queryRunner,
      'appointments',
      'IDX_appointments_tenant_doctor_date_status',
    );
    await this.dropIndexConcurrently(
      queryRunner,
      'medical_records',
      'IDX_medical_records_org_patient_status_recordDate',
    );
    await this.dropIndexConcurrently(queryRunner, 'patients', 'IDX_patients_lastName_firstName');
    await this.dropIndexConcurrently(queryRunner, 'patients', 'IDX_patients_active_dob_sex');
  }

  /**
   * Creates a (optionally DESC-suffixed) composite index using
   * `CREATE INDEX CONCURRENTLY IF NOT EXISTS` so that deploying this
   * migration does not hold a write lock on high-traffic tables, and is
   * idempotent against partial re-runs. Falls back to silently skipping if
   * the target table doesn't exist in the current schema (keeps this
   * migration safe to run against minimal/test schemas).
   *
   * Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block;
   * this is expected to be run via the project's standard
   * `migration:run` command, consistent with the CONCURRENTLY usage already
   * established in `1775800000000-AddAuditLogCompositeIndexes.ts`.
   */
  private async createIndexConcurrently(
    queryRunner: QueryRunner,
    table: string,
    indexName: string,
    columns: string[],
    opts?: { timestampDesc?: string },
  ): Promise<void> {
    if (!(await this.tableExists(queryRunner, table))) {
      return;
    }

    const resolvedColumns = await this.filterExistingColumns(queryRunner, table, columns);
    if (resolvedColumns.length !== columns.length) {
      // Schema doesn't match expectations (e.g. different audit_logs shape) — skip safely.
      return;
    }

    let columnSql = resolvedColumns.map((column) => `"${column}"`).join(', ');

    if (opts?.timestampDesc) {
      const hasTimestampColumn = (
        await this.filterExistingColumns(queryRunner, table, [opts.timestampDesc])
      ).length === 1;
      if (!hasTimestampColumn) {
        return;
      }
      columnSql = `${columnSql}, "${opts.timestampDesc}" DESC`;
    }

    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "${table}" (${columnSql})`,
    );
  }

  private async dropIndexConcurrently(
    queryRunner: QueryRunner,
    table: string,
    indexName: string,
  ): Promise<void> {
    if (!(await this.tableExists(queryRunner, table))) {
      return;
    }
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "${indexName}"`);
  }

  private async filterExistingColumns(
    queryRunner: QueryRunner,
    table: string,
    columns: string[],
  ): Promise<string[]> {
    const rows: Array<{ column_name: string }> = await queryRunner.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `,
      [table],
    );
    const existingColumns = new Set(rows.map((row) => row.column_name));
    return columns.filter((column) => existingColumns.has(column));
  }

  private async tableExists(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const result: Array<{ exists: boolean }> = await queryRunner.query(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      [`public.${table}`],
    );
    return Boolean(result[0]?.exists);
  }
}
