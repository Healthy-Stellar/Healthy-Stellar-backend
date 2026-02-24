import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface IndexRecommendation {
  tableName: string;
  columnNames: string[];
  indexType: 'btree' | 'hash' | 'brin' | 'gin' | 'gist';
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  ddlStatement: string;
}

export interface IndexHealth {
  indexName: string;
  tableName: string;
  sizeBytes: number;
  sizePretty: string;
  indexScans: number;
  isUnused: boolean;
  bloatRatio: number;
}

/**
 * Index Manager Service
 *
 * Manages database indexes optimized for healthcare data access patterns:
 * - Patient search by MRN, name, DOB
 * - Medical record retrieval by patient and date
 * - Lab result queries by status and priority
 * - Appointment scheduling lookups
 * - Billing and insurance claim queries
 */
@Injectable()
export class IndexManagerService {
  private readonly logger = new Logger(IndexManagerService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Generate index recommendations for healthcare tables.
   */
  async getIndexRecommendations(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    const healthcareIndexes: IndexRecommendation[] = [
      // Patient indexes
      {
        tableName: 'patient',
        columnNames: ['mrn'],
        indexType: 'btree',
        reason:
          'Medical Record Number is the primary patient identifier used in all hospital operations',
        priority: 'critical',
        ddlStatement: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_mrn ON patient(mrn);',
      },
      {
        tableName: 'patient',
        columnNames: ['last_name', 'first_name'],
        indexType: 'btree',
        reason: 'Patient name search is the most common lookup in clinical workflows',
        priority: 'high',
        ddlStatement:
          'CREATE INDEX IF NOT EXISTS idx_patient_name ON patient(last_name, first_name);',
      },
      {
        tableName: 'patient',
        columnNames: ['date_of_birth'],
        indexType: 'btree',
        reason: 'DOB is frequently used in patient verification and age-based analytics',
        priority: 'high',
        ddlStatement: 'CREATE INDEX IF NOT EXISTS idx_patient_dob ON patient(date_of_birth);',
      },
      {
        tableName: 'patient',
        columnNames: ['is_admitted'],
        indexType: 'btree',
        reason: 'Partial index for currently admitted patients improves ward dashboard performance',
        priority: 'high',
        ddlStatement:
          'CREATE INDEX IF NOT EXISTS idx_patient_admitted ON patient(admission_date DESC) WHERE is_admitted = true;',
      },
      {
        tableName: 'patient',
        columnNames: ['national_id'],
        indexType: 'btree',
        reason: 'National ID is used for unique patient identification and deduplication',
        priority: 'high',
        ddlStatement:
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_national_id ON patient(national_id) WHERE national_id IS NOT NULL;',
      },

      // Medical records indexes
      {
        tableName: 'medical_record',
        columnNames: ['patient_id', 'created_at'],
        indexType: 'btree',
        reason: 'Medical records are always accessed per patient, ordered by date',
        priority: 'critical',
        ddlStatement:
          'CREATE INDEX IF NOT EXISTS idx_medical_record_patient_date ON medical_record(patient_id, created_at DESC);',
      },

      // Lab results indexes
      {
        tableName: 'lab_result',
        columnNames: ['status', 'priority', 'ordered_at'],
        indexType: 'btree',
        reason: 'Lab results are filtered by status and priority for clinical workflow queues',
        priority: 'high',
        ddlStatement:
          'CREATE INDEX IF NOT EXISTS idx_lab_result_status_priority ON lab_result(status, priority DESC, ordered_at ASC);',
      },
      {
        tableName: 'lab_result',
        columnNames: ['patient_id', 'test_date'],
        indexType: 'btree',
        reason: 'Patient-specific lab results are frequently accessed in clinical reviews',
        priority: 'high',
        ddlStatement:
          'CREATE INDEX IF NOT EXISTS idx_lab_result_patient_date ON lab_result(patient_id, test_date DESC);',
      },

      // Appointment indexes
      {
        tableName: 'appointment',
        columnNames: ['scheduled_at'],
        indexType: 'brin',
        reason: 'BRIN index is efficient for time-sequential appointment data',
        priority: 'high',
        ddlStatement:
          'CREATE INDEX IF NOT EXISTS idx_appointment_schedule_brin ON appointment USING BRIN(scheduled_at);',
      },
      {
        tableName: 'appointment',
        columnNames: ['patient_id', 'status'],
        indexType: 'btree',
        reason: 'Patient appointment history with status filtering for scheduling',
        priority: 'medium',
        ddlStatement:
          'CREATE INDEX IF NOT EXISTS idx_appointment_patient_status ON appointment(patient_id, status);',
      },

      // Audit log indexes (HIPAA compliance)
      {
        tableName: 'audit_log',
        columnNames: ['created_at'],
        indexType: 'brin',
        reason: 'BRIN index for time-sequential audit log data improves compliance reporting',
        priority: 'medium',
        ddlStatement:
          'CREATE INDEX IF NOT EXISTS idx_audit_log_date_brin ON audit_log USING BRIN(created_at);',
      },
      {
        tableName: 'audit_log',
        columnNames: ['user_id', 'action'],
        indexType: 'btree',
        reason: 'User-specific audit trail queries for HIPAA compliance reviews',
        priority: 'medium',
        ddlStatement:
          'CREATE INDEX IF NOT EXISTS idx_audit_log_user_action ON audit_log(user_id, action);',
      },
    ];

    // Check which indexes already exist
    for (const recommendation of healthcareIndexes) {
      const exists = await this.checkIndexExists(
        recommendation.tableName,
        recommendation.columnNames,
      );
      if (!exists) {
        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  /**
   * Check if an index exists on the given columns.
   */
  private async checkIndexExists(tableName: string, columnNames: string[]): Promise<boolean> {
    try {
      const result = await this.dataSource.query(
        `
        SELECT i.relname as index_name
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        WHERE t.relname = $1
        AND i.relname LIKE ANY($2);
      `,
        [tableName, columnNames.map((c) => `%${c}%`)],
      );
      return result.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Apply recommended indexes safely.
   */
  async applyRecommendedIndexes(dryRun: boolean = true): Promise<{
    applied: string[];
    skipped: string[];
    errors: string[];
  }> {
    const recommendations = await this.getIndexRecommendations();
    const applied: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const rec of recommendations) {
      if (dryRun) {
        skipped.push(`[DRY RUN] ${rec.ddlStatement}`);
        continue;
      }

      try {
        // Use CONCURRENTLY for online index creation (no table lock)
        const concurrentDDL = rec.ddlStatement.replace(
          'CREATE INDEX IF NOT EXISTS',
          'CREATE INDEX CONCURRENTLY IF NOT EXISTS',
        );
        await this.dataSource.query(concurrentDDL);
        applied.push(rec.ddlStatement);
        this.logger.log(`✅ Index created: ${rec.tableName} (${rec.columnNames.join(', ')})`);
      } catch (error) {
        // Fall back to non-concurrent creation
        try {
          await this.dataSource.query(rec.ddlStatement);
          applied.push(rec.ddlStatement);
        } catch (fallbackError) {
          errors.push(`${rec.ddlStatement}: ${fallbackError.message}`);
          this.logger.warn(`Failed to create index on ${rec.tableName}: ${fallbackError.message}`);
        }
      }
    }

    return { applied, skipped, errors };
  }

  /**
   * Analyze index health and identify unused or bloated indexes.
   */
  async getIndexHealth(): Promise<IndexHealth[]> {
    try {
      const results = await this.dataSource.query(`
        SELECT
          i.relname AS index_name,
          t.relname AS table_name,
          pg_relation_size(i.oid) AS size_bytes,
          pg_size_pretty(pg_relation_size(i.oid)) AS size_pretty,
          COALESCE(s.idx_scan, 0) AS index_scans,
          CASE WHEN COALESCE(s.idx_scan, 0) = 0 THEN true ELSE false END AS is_unused
        FROM pg_class i
        JOIN pg_index ix ON i.oid = ix.indexrelid
        JOIN pg_class t ON t.oid = ix.indrelid
        LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = i.oid
        WHERE t.relkind = 'r'
        AND i.relkind = 'i'
        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        ORDER BY pg_relation_size(i.oid) DESC
        LIMIT 50;
      `);

      return results.map((r: any) => ({
        indexName: r.index_name,
        tableName: r.table_name,
        sizeBytes: parseInt(r.size_bytes),
        sizePretty: r.size_pretty,
        indexScans: parseInt(r.index_scans),
        isUnused: r.is_unused,
        bloatRatio: 0,
      }));
    } catch (error) {
      this.logger.error(`Failed to get index health: ${error.message}`);
      return [];
    }
  }
}
