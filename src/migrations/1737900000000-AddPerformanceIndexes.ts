import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Database Performance Optimization Migration
 * 
 * This migration adds strategic indexes to improve query performance
 * for the most common query patterns in the healthcare system.
 * 
 * Indexes Added:
 * 1. medical_records.patient_id - Single column index for patient record lookups
 * 2. access_grants(patient_id, grantee_id, expires_at) - Composite index for access validation
 * 3. audit_logs(actor_id, created_at) - Composite index for user activity reports
 * 4. audit_logs(resource_id) - Single column index for resource audit trails
 * 
 * Performance Impact:
 * - Medical record queries by patient: Expected 80-95% improvement
 * - Access grant validation: Expected 70-90% improvement
 * - Audit log queries: Expected 60-85% improvement
 * 
 * HIPAA Compliance:
 * - All indexes support audit trail requirements
 * - No PHI data is indexed in plain text
 * - Supports efficient access log retrieval for compliance reporting
 */
export class AddPerformanceIndexes1737900000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1737900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================================
    // MEDICAL RECORDS INDEXES
    // ============================================================================
    
    /**
     * Index: medical_records.patient_id
     * 
     * Query Pattern: SELECT * FROM medical_records WHERE patient_id = ?
     * Frequency: Very High (every patient record access)
     * Impact: Critical for patient record retrieval performance
     * 
     * Used by:
     * - MedicalRecordsService.search() - Patient record filtering
     * - MedicalRecordsService.findOne() - Patient-specific record access
     * - MedicalRecordsService.getTimeline() - Patient history retrieval
     */
    await queryRunner.createIndex(
      'medical_records',
      new TableIndex({
        name: 'IDX_medical_records_patient_id',
        columnNames: ['patient_id'],
      }),
    );

    /**
     * Index: medical_records(patient_id, record_type, status, created_at)
     * 
     * Query Pattern: Complex filtering with multiple conditions
     * SELECT * FROM medical_records 
     * WHERE patient_id = ? AND record_type = ? AND status = ?
     * ORDER BY created_at DESC
     * 
     * Frequency: High (search and filter operations)
     * Impact: Significant improvement for filtered searches
     * 
     * Used by:
     * - MedicalRecordsService.search() - Multi-criteria filtering
     * - Dashboard queries - Status-based record counts
     * - Report generation - Type-specific record retrieval
     */
    await queryRunner.createIndex(
      'medical_records',
      new TableIndex({
        name: 'IDX_medical_records_patient_type_status_date',
        columnNames: ['patient_id', 'record_type', 'status', 'created_at'],
      }),
    );

    /**
     * Index: medical_records(status, record_type)
     * 
     * Query Pattern: Global filtering without patient context
     * SELECT * FROM medical_records WHERE status = ? AND record_type = ?
     * 
     * Frequency: Medium (administrative queries, reports)
     * Impact: Improves system-wide record queries
     * 
     * Note: This index already exists in entity decorators but ensuring
     * it's created via migration for consistency
     */
    const existingStatusTypeIndex = await queryRunner.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'medical_records' 
      AND indexname LIKE '%status%record_type%'
    `);
    
    if (existingStatusTypeIndex.length === 0) {
      await queryRunner.createIndex(
        'medical_records',
        new TableIndex({
          name: 'IDX_medical_records_status_record_type',
          columnNames: ['status', 'record_type'],
        }),
      );
    }

    // ============================================================================
    // ACCESS GRANTS INDEXES
    // ============================================================================

    /**
     * Index: access_grants(patient_id, grantee_id, expires_at)
     * 
     * Query Pattern: Access validation with expiration check
     * SELECT * FROM access_grants 
     * WHERE patient_id = ? AND grantee_id = ? 
     * AND (expires_at IS NULL OR expires_at > NOW())
     * AND status = 'ACTIVE'
     * 
     * Frequency: Very High (every access control check)
     * Impact: Critical for access control performance
     * 
     * Used by:
     * - AccessControlService.grantAccess() - Duplicate grant detection
     * - AccessControlService.getPatientGrants() - Patient grant listing
     * - Access validation middleware - Real-time permission checks
     * 
     * HIPAA Compliance: Essential for audit trail of access grants
     */
    await queryRunner.createIndex(
      'access_grants',
      new TableIndex({
        name: 'IDX_access_grants_patient_grantee_expires',
        columnNames: ['patient_id', 'grantee_id', 'expires_at'],
      }),
    );

    /**
     * Index: access_grants(grantee_id, status, expires_at)
     * 
     * Query Pattern: User's received grants with status filtering
     * SELECT * FROM access_grants 
     * WHERE grantee_id = ? AND status = 'ACTIVE'
     * AND (expires_at IS NULL OR expires_at > NOW())
     * 
     * Frequency: High (user dashboard, permission checks)
     * Impact: Improves user-centric access grant queries
     * 
     * Used by:
     * - AccessControlService.getReceivedGrants() - User's access list
     * - User dashboard - Display granted access
     */
    await queryRunner.createIndex(
      'access_grants',
      new TableIndex({
        name: 'IDX_access_grants_grantee_status_expires',
        columnNames: ['grantee_id', 'status', 'expires_at'],
      }),
    );

    /**
     * Index: access_grants(status, expires_at)
     * 
     * Query Pattern: Batch expiration processing
     * SELECT * FROM access_grants 
     * WHERE status = 'ACTIVE' AND expires_at < NOW()
     * 
     * Frequency: Medium (scheduled jobs)
     * Impact: Efficient batch processing of expired grants
     * 
     * Used by:
     * - Scheduled job - Expire old grants
     * - Cleanup operations - Remove expired access
     */
    await queryRunner.createIndex(
      'access_grants',
      new TableIndex({
        name: 'IDX_access_grants_status_expires',
        columnNames: ['status', 'expires_at'],
      }),
    );

    // ============================================================================
    // AUDIT LOGS INDEXES (HIPAA Compliance Critical)
    // ============================================================================

    /**
     * Index: audit_logs(user_id, timestamp)
     * 
     * Query Pattern: User activity timeline
     * SELECT * FROM audit_logs 
     * WHERE user_id = ? 
     * ORDER BY timestamp DESC
     * 
     * Frequency: High (audit reports, user activity tracking)
     * Impact: Critical for HIPAA audit trail queries
     * 
     * Used by:
     * - Audit reports - User activity history
     * - Security investigations - User action tracking
     * - Compliance reports - Access pattern analysis
     * 
     * Note: Checking if already exists from entity decorators
     */
    const existingUserTimestampIndex = await queryRunner.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'audit_logs' 
      AND indexname LIKE '%user_id%timestamp%'
    `);
    
    if (existingUserTimestampIndex.length === 0) {
      await queryRunner.createIndex(
        'audit_logs',
        new TableIndex({
          name: 'IDX_audit_logs_user_id_timestamp',
          columnNames: ['user_id', 'timestamp'],
        }),
      );
    }

    /**
     * Index: audit_logs(entity_id)
     * 
     * Query Pattern: Resource-specific audit trail
     * SELECT * FROM audit_logs WHERE entity_id = ?
     * 
     * Frequency: High (record history, compliance checks)
     * Impact: Essential for resource audit trails
     * 
     * Used by:
     * - Medical record history - Track all changes to a record
     * - Patient access logs - Who accessed specific patient data
     * - Compliance audits - Resource-level access tracking
     * 
     * HIPAA Compliance: Required for tracking all PHI access
     */
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_entity_id',
        columnNames: ['entity_id'],
      }),
    );

    /**
     * Index: audit_logs(operation, timestamp)
     * 
     * Query Pattern: Operation-specific audit queries
     * SELECT * FROM audit_logs 
     * WHERE operation = ? 
     * ORDER BY timestamp DESC
     * 
     * Frequency: Medium (security monitoring, compliance reports)
     * Impact: Improves operation-based filtering
     * 
     * Used by:
     * - Security monitoring - Track specific operations (DELETE, UPDATE)
     * - Compliance reports - Operation frequency analysis
     * - Anomaly detection - Unusual operation patterns
     */
    const existingOperationTimestampIndex = await queryRunner.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'audit_logs' 
      AND indexname LIKE '%operation%timestamp%'
    `);
    
    if (existingOperationTimestampIndex.length === 0) {
      await queryRunner.createIndex(
        'audit_logs',
        new TableIndex({
          name: 'IDX_audit_logs_operation_timestamp',
          columnNames: ['operation', 'timestamp'],
        }),
      );
    }

    /**
     * Index: audit_logs(entity_type, entity_id, timestamp)
     * 
     * Query Pattern: Entity-specific audit trail with type filtering
     * SELECT * FROM audit_logs 
     * WHERE entity_type = ? AND entity_id = ?
     * ORDER BY timestamp DESC
     * 
     * Frequency: High (detailed audit trails)
     * Impact: Optimizes entity-specific audit queries
     * 
     * Used by:
     * - Detailed audit trails - Complete history of specific entities
     * - Compliance reports - Entity-type specific access patterns
     */
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'IDX_audit_logs_entity_type_id_timestamp',
        columnNames: ['entity_type', 'entity_id', 'timestamp'],
      }),
    );

    // ============================================================================
    // MEDICAL HISTORY INDEXES
    // ============================================================================

    /**
     * Index: medical_history(patient_id, event_date)
     * 
     * Query Pattern: Patient timeline queries
     * SELECT * FROM medical_history 
     * WHERE patient_id = ? 
     * ORDER BY event_date DESC
     * 
     * Frequency: High (patient timeline, history views)
     * Impact: Improves patient history retrieval
     * 
     * Used by:
     * - MedicalRecordsService.getTimeline() - Patient event timeline
     * - Patient dashboard - Recent activity display
     */
    await queryRunner.createIndex(
      'medical_history',
      new TableIndex({
        name: 'IDX_medical_history_patient_event_date',
        columnNames: ['patient_id', 'event_date'],
      }),
    );

    /**
     * Index: medical_history(medical_record_id, event_date)
     * 
     * Query Pattern: Record-specific history
     * SELECT * FROM medical_history 
     * WHERE medical_record_id = ? 
     * ORDER BY event_date DESC
     * 
     * Frequency: Medium (record history views)
     * Impact: Improves record-specific history queries
     */
    await queryRunner.createIndex(
      'medical_history',
      new TableIndex({
        name: 'IDX_medical_history_record_event_date',
        columnNames: ['medical_record_id', 'event_date'],
      }),
    );

    // ============================================================================
    // ANALYZE TABLES FOR QUERY PLANNER
    // ============================================================================

    /**
     * Update table statistics for query planner optimization
     * This helps PostgreSQL choose the most efficient query plans
     */
    await queryRunner.query('ANALYZE medical_records');
    await queryRunner.query('ANALYZE access_grants');
    await queryRunner.query('ANALYZE audit_logs');
    await queryRunner.query('ANALYZE medical_history');

    // Log migration completion
    console.log('✅ Performance indexes created successfully');
    console.log('📊 Run EXPLAIN ANALYZE on your queries to verify index usage');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.dropIndex('medical_history', 'IDX_medical_history_record_event_date');
    await queryRunner.dropIndex('medical_history', 'IDX_medical_history_patient_event_date');
    
    await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_entity_type_id_timestamp');
    
    const existingOperationTimestampIndex = await queryRunner.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'audit_logs' 
      AND indexname = 'IDX_audit_logs_operation_timestamp'
    `);
    if (existingOperationTimestampIndex.length > 0) {
      await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_operation_timestamp');
    }
    
    await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_entity_id');
    
    const existingUserTimestampIndex = await queryRunner.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'audit_logs' 
      AND indexname = 'IDX_audit_logs_user_id_timestamp'
    `);
    if (existingUserTimestampIndex.length > 0) {
      await queryRunner.dropIndex('audit_logs', 'IDX_audit_logs_user_id_timestamp');
    }
    
    await queryRunner.dropIndex('access_grants', 'IDX_access_grants_status_expires');
    await queryRunner.dropIndex('access_grants', 'IDX_access_grants_grantee_status_expires');
    await queryRunner.dropIndex('access_grants', 'IDX_access_grants_patient_grantee_expires');
    
    const existingStatusTypeIndex = await queryRunner.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'medical_records' 
      AND indexname = 'IDX_medical_records_status_record_type'
    `);
    if (existingStatusTypeIndex.length > 0) {
      await queryRunner.dropIndex('medical_records', 'IDX_medical_records_status_record_type');
    }
    
    await queryRunner.dropIndex('medical_records', 'IDX_medical_records_patient_type_status_date');
    await queryRunner.dropIndex('medical_records', 'IDX_medical_records_patient_id');

    console.log('✅ Performance indexes dropped successfully');
  }
}
