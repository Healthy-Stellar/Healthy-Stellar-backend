import { Injectable } from '@nestjs/common';

export interface IndexOptimizationEntry {
  table: string;
  index: string;
  queryPattern: string;
  basis: string;
}

@Injectable()
export class AppService {
  getHello(): { message: string; status: string } {
    return {
      message: 'Welcome to NestJS Query Optimization Service',
      status: 'running',
    };
  }

  health(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Static report of the composite indexes added for issue #760
   * (Database Query Performance Profiling and Index Optimization).
   *
   * This intentionally does not query `pg_indexes` or `pg_stat_statements`
   * live — it mirrors the reasoning documented in
   * `src/migrations/1782570000000-AddQueryPerformanceProfilingIndexes.ts`,
   * which was derived from static analysis of `scripts/benchmark-database-performance.ts`
   * and `scripts/explain-query-plans.ts` plus real repository/service query
   * usage, since a live load test was not run. p95 latency validation for
   * these indexes should happen in CI/staging, not be inferred here.
   */
  indexOptimizationReport(): {
    issue: string;
    basis: string;
    validation: string;
    indexes: IndexOptimizationEntry[];
  } {
    return {
      issue: '#760 Database Query Performance Profiling and Index Optimization',
      basis:
        'Static query-pattern analysis of scripts/benchmark-database-performance.ts, ' +
        'scripts/explain-query-plans.ts, and entity/service .where()/.andWhere()/find() usage. ' +
        'No live load test was executed, so no p95 numbers are claimed.',
      validation:
        'p95 latency impact should be confirmed by running npm run benchmark:db and ' +
        'npm run explain:queries before/after this migration in CI or staging.',
      indexes: [
        {
          table: 'patients',
          index: 'IDX_patients_active_dob_sex',
          queryPattern: 'WHERE isActive = true AND dateOfBirth = ? AND sex = ?',
          basis: 'PatientsService.detectDuplicate() — run on every patient creation',
        },
        {
          table: 'patients',
          index: 'IDX_patients_lastName_firstName',
          queryPattern: 'WHERE lastName ILIKE ? OR firstName ILIKE ?',
          basis: 'PatientsService.search() — patient lookup/typeahead',
        },
        {
          table: 'medical_records',
          index: 'IDX_medical_records_org_patient_status_recordDate',
          queryPattern:
            'WHERE organizationId = ? AND patientId = ? AND status = ? AND recordDate BETWEEN ? AND ?',
          basis: 'MedicalRecordsService.search() / fullTextSearch() multi-tenant filters',
        },
        {
          table: 'appointments',
          index: 'IDX_appointments_tenant_doctor_date_status',
          queryPattern: 'WHERE tenant_id = ? AND doctor_id = ? AND appointment_date BETWEEN ? AND ?',
          basis: 'AppointmentService.findByDoctor() / getAvailableSlots()',
        },
        {
          table: 'appointments',
          index: 'IDX_appointments_tenant_patient_date',
          queryPattern: 'WHERE tenant_id = ? AND patient_id = ? ORDER BY appointment_date',
          basis: 'AppointmentService.findAll() scoped to PATIENT role',
        },
        {
          table: 'appointments',
          index: 'IDX_appointments_doctor_start_end',
          queryPattern: 'WHERE doctor_id = ? AND start_time < ? AND end_time > ?',
          basis: 'AppointmentService.create() overlap-detection lock (booking transaction)',
        },
        {
          table: 'audit_logs',
          index: 'IDX_audit_logs_entity_type_entity_id_timestamp',
          queryPattern: 'WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp DESC',
          basis: 'explain-query-plans.ts / benchmark "Resource Audit Trail" queries',
        },
        {
          table: 'audit_logs',
          index: 'IDX_audit_logs_operation_timestamp',
          queryPattern: 'WHERE operation = ? ORDER BY timestamp DESC',
          basis: 'benchmark-database-performance.ts "Operation Filter" query',
        },
      ],
    };
  }
}
