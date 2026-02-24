import { Injectable, Logger } from '@nestjs/common';

/**
 * Query Optimizer Service
 *
 * Provides healthcare-specific SQL query optimization suggestions
 * based on pattern analysis. Focuses on common hospital data access patterns:
 * - Patient lookup queries
 * - Medical record searches
 * - Lab result aggregations
 * - Appointment scheduling queries
 * - Billing and insurance queries
 */
@Injectable()
export class QueryOptimizerService {
  private readonly logger = new Logger(QueryOptimizerService.name);

  /**
   * Healthcare-specific query patterns that commonly cause performance issues.
   */
  private readonly healthcareQueryPatterns = [
    {
      pattern: /SELECT\s+\*\s+FROM/i,
      suggestion:
        'Avoid SELECT * in healthcare queries. Select only needed columns to reduce data transfer, ' +
        'especially for tables with encrypted PHI fields.',
      severity: 'high',
    },
    {
      pattern: /WHERE.*LIKE\s+'%/i,
      suggestion:
        'Leading wildcard in LIKE clause prevents index usage. For patient name searches, ' +
        'consider using PostgreSQL full-text search (tsvector/tsquery) or trigram indexes.',
      severity: 'high',
    },
    {
      pattern: /(?:patient|medical_record|lab_result).*(?:WITHOUT|NO)\s+.*(?:INDEX|WHERE)/i,
      suggestion:
        'Medical data tables should always have appropriate indexes on lookup columns ' +
        '(mrn, patient_id, date fields).',
      severity: 'critical',
    },
    {
      pattern: /ORDER\s+BY.*(?:created_at|date|timestamp).*(?:DESC|ASC)/i,
      suggestion:
        'Time-based sorting on medical records benefits from BRIN indexes on date columns ' +
        'for large healthcare datasets.',
      severity: 'medium',
    },
    {
      pattern: /JOIN.*JOIN.*JOIN.*JOIN/i,
      suggestion:
        'Multiple JOINs detected. For complex medical record retrieval across related tables, ' +
        'consider materialized views or denormalization for read-heavy operations.',
      severity: 'medium',
    },
    {
      pattern: /COUNT\(\*\)\s+FROM\s+(?:patient|medical_record|appointment|lab_result)/i,
      suggestion:
        'Full COUNT(*) on large medical tables is expensive. Use pg_class.reltuples for estimates ' +
        'or maintain a counter cache for dashboard statistics.',
      severity: 'medium',
    },
    {
      pattern: /(?:NOT\s+IN|<>|!=)\s*\(/i,
      suggestion:
        'NOT IN with subqueries can be slow. Replace with NOT EXISTS or LEFT JOIN IS NULL ' +
        'for better performance in medical data filtering.',
      severity: 'medium',
    },
    {
      pattern: /GROUP\s+BY.*HAVING/i,
      suggestion:
        'GROUP BY with HAVING on medical data can be optimized by filtering with WHERE first ' +
        'to reduce the dataset before aggregation.',
      severity: 'low',
    },
  ];

  /**
   * Analyze a SQL query and provide optimization suggestions.
   */
  suggestOptimization(query: string): string {
    const suggestions: string[] = [];

    for (const { pattern, suggestion, severity } of this.healthcareQueryPatterns) {
      if (pattern.test(query)) {
        suggestions.push(`[${severity.toUpperCase()}] ${suggestion}`);
      }
    }

    // Check for missing WHERE clause on healthcare data tables
    const healthcareTables = [
      'patient',
      'medical_record',
      'appointment',
      'lab_result',
      'prescription',
      'billing',
      'diagnosis',
      'treatment',
      'medication_administration',
      'infection_control',
    ];

    for (const table of healthcareTables) {
      const tablePattern = new RegExp(`FROM\\s+["']?${table}["']?\\s*(?:$|ORDER|GROUP|LIMIT)`, 'i');
      if (tablePattern.test(query)) {
        suggestions.push(
          `[CRITICAL] Query on "${table}" without WHERE clause detected. ` +
            'This is a full table scan on healthcare data – add filtering to improve performance.',
        );
      }
    }

    if (suggestions.length === 0) {
      return 'No specific optimization suggestions. Consider checking execution plan for further analysis.';
    }

    return suggestions.join('\n');
  }

  /**
   * Generate optimized query recommendations for specific healthcare operations.
   */
  getOptimizedQueryTemplate(operation: string): string | null {
    const templates: Record<string, string> = {
      'patient-lookup': `
        -- Optimized patient lookup with index hints
        SELECT id, mrn, first_name, last_name, date_of_birth, is_admitted
        FROM patient
        WHERE mrn = $1 OR id = $1
        LIMIT 1;
        -- Ensure indexes exist: CREATE INDEX idx_patient_mrn ON patient(mrn);
      `,
      'medical-records-by-patient': `
        -- Optimized medical records retrieval with pagination
        SELECT mr.id, mr.record_type, mr.created_at, mr.summary
        FROM medical_record mr
        WHERE mr.patient_id = $1
        ORDER BY mr.created_at DESC
        LIMIT $2 OFFSET $3;
        -- Ensure composite index: CREATE INDEX idx_medical_record_patient_date 
        --   ON medical_record(patient_id, created_at DESC);
      `,
      'active-admissions': `
        -- Optimized active admissions query
        SELECT p.id, p.mrn, p.first_name, p.last_name, 
               p.admission_date, w.name as ward_name
        FROM patient p
        LEFT JOIN ward_assignment wa ON p.id = wa.patient_id AND wa.is_active = true
        LEFT JOIN ward w ON wa.ward_id = w.id
        WHERE p.is_admitted = true
        ORDER BY p.admission_date DESC;
        -- Ensure partial index: CREATE INDEX idx_patient_admitted 
        --   ON patient(admission_date DESC) WHERE is_admitted = true;
      `,
      'lab-results-pending': `
        -- Optimized pending lab results query
        SELECT lr.id, lr.test_name, lr.patient_id, lr.ordered_at, 
               p.mrn, p.first_name, p.last_name
        FROM lab_result lr
        JOIN patient p ON lr.patient_id = p.id
        WHERE lr.status = 'pending'
        ORDER BY lr.priority DESC, lr.ordered_at ASC;
        -- Ensure index: CREATE INDEX idx_lab_result_status_priority 
        --   ON lab_result(status, priority DESC, ordered_at ASC);
      `,
      'appointment-schedule': `
        -- Optimized appointment schedule for a date range
        SELECT a.id, a.scheduled_at, a.duration_minutes, a.status,
               p.mrn, p.first_name, p.last_name,
               d.name as department_name
        FROM appointment a
        JOIN patient p ON a.patient_id = p.id
        LEFT JOIN department d ON a.department_id = d.id
        WHERE a.scheduled_at BETWEEN $1 AND $2
        AND a.status != 'cancelled'
        ORDER BY a.scheduled_at ASC;
        -- Ensure BRIN index: CREATE INDEX idx_appointment_schedule 
        --   ON appointment USING BRIN(scheduled_at);
      `,
    };

    return templates[operation] || null;
  }
}
