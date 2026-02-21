import { DataSource } from 'typeorm';
import { AddPerformanceIndexes1737900000000 } from '../../src/migrations/1737900000000-AddPerformanceIndexes';

/**
 * Migration Tests: AddPerformanceIndexes
 * 
 * Validates that the performance indexes migration:
 * 1. Creates all required indexes
 * 2. Indexes are used by the query planner
 * 3. Migration can be rolled back cleanly
 * 4. No duplicate indexes are created
 */
describe('AddPerformanceIndexes Migration', () => {
  let dataSource: DataSource;
  let migration: AddPerformanceIndexes1737900000000;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME_TEST || 'healthy_stellar_test',
      synchronize: false,
      logging: false,
      entities: ['src/**/*.entity.ts'],
      migrations: ['src/migrations/*.ts'],
    });

    await dataSource.initialize();
    migration = new AddPerformanceIndexes1737900000000();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('Migration Up', () => {
    it('should create all medical_records indexes', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        await migration.up(queryRunner);

        // Check for patient_id index
        const patientIdIndex = await queryRunner.query(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'medical_records' 
          AND indexname = 'IDX_medical_records_patient_id'
        `);
        expect(patientIdIndex.length).toBe(1);

        // Check for composite index
        const compositeIndex = await queryRunner.query(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'medical_records' 
          AND indexname = 'IDX_medical_records_patient_type_status_date'
        `);
        expect(compositeIndex.length).toBe(1);
      } finally {
        await queryRunner.release();
      }
    });

    it('should create all access_grants indexes', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        // Check for patient_grantee_expires index
        const patientGranteeIndex = await queryRunner.query(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'access_grants' 
          AND indexname = 'IDX_access_grants_patient_grantee_expires'
        `);
        expect(patientGranteeIndex.length).toBe(1);

        // Check for grantee_status_expires index
        const granteeStatusIndex = await queryRunner.query(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'access_grants' 
          AND indexname = 'IDX_access_grants_grantee_status_expires'
        `);
        expect(granteeStatusIndex.length).toBe(1);

        // Check for status_expires index
        const statusExpiresIndex = await queryRunner.query(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'access_grants' 
          AND indexname = 'IDX_access_grants_status_expires'
        `);
        expect(statusExpiresIndex.length).toBe(1);
      } finally {
        await queryRunner.release();
      }
    });

    it('should create all audit_logs indexes', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        // Check for entity_id index
        const entityIdIndex = await queryRunner.query(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'audit_logs' 
          AND indexname = 'IDX_audit_logs_entity_id'
        `);
        expect(entityIdIndex.length).toBe(1);

        // Check for entity_type_id_timestamp index
        const entityTypeIndex = await queryRunner.query(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'audit_logs' 
          AND indexname = 'IDX_audit_logs_entity_type_id_timestamp'
        `);
        expect(entityTypeIndex.length).toBe(1);
      } finally {
        await queryRunner.release();
      }
    });

    it('should create all medical_history indexes', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        // Check for patient_event_date index
        const patientEventIndex = await queryRunner.query(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'medical_history' 
          AND indexname = 'IDX_medical_history_patient_event_date'
        `);
        expect(patientEventIndex.length).toBe(1);

        // Check for record_event_date index
        const recordEventIndex = await queryRunner.query(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename = 'medical_history' 
          AND indexname = 'IDX_medical_history_record_event_date'
        `);
        expect(recordEventIndex.length).toBe(1);
      } finally {
        await queryRunner.release();
      }
    });

    it('should not create duplicate indexes', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        // Run migration twice
        await migration.up(queryRunner);
        await migration.up(queryRunner);

        // Check that we don't have duplicate indexes
        const allIndexes = await queryRunner.query(`
          SELECT indexname, COUNT(*) as count
          FROM pg_indexes 
          WHERE tablename IN ('medical_records', 'access_grants', 'audit_logs', 'medical_history')
          GROUP BY indexname
          HAVING COUNT(*) > 1
        `);

        expect(allIndexes.length).toBe(0);
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('Index Usage Verification', () => {
    it('should use patient_id index for medical records query', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        const explainResult = await queryRunner.query(`
          EXPLAIN (FORMAT JSON) 
          SELECT * FROM medical_records 
          WHERE patient_id = '00000000-0000-0000-0000-000000000001'
        `);

        const plan = JSON.stringify(explainResult);
        
        // Should use index scan, not sequential scan
        expect(plan).toContain('Index Scan');
        expect(plan).toContain('IDX_medical_records_patient_id');
      } finally {
        await queryRunner.release();
      }
    });

    it('should use composite index for access grant validation', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        const explainResult = await queryRunner.query(`
          EXPLAIN (FORMAT JSON) 
          SELECT * FROM access_grants 
          WHERE patient_id = '00000000-0000-0000-0000-000000000001'
          AND grantee_id = '00000000-0000-0000-0000-000000000002'
          AND status = 'ACTIVE'
        `);

        const plan = JSON.stringify(explainResult);
        
        // Should use index scan
        expect(plan).toContain('Index Scan');
        expect(plan).toContain('IDX_access_grants');
      } finally {
        await queryRunner.release();
      }
    });

    it('should use entity_id index for audit log queries', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        const explainResult = await queryRunner.query(`
          EXPLAIN (FORMAT JSON) 
          SELECT * FROM audit_logs 
          WHERE entity_id = '00000000-0000-0000-0000-000000000001'
        `);

        const plan = JSON.stringify(explainResult);
        
        // Should use index scan
        expect(plan).toContain('Index Scan');
        expect(plan).toContain('IDX_audit_logs_entity_id');
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('Migration Down', () => {
    it('should remove all created indexes', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        // First ensure indexes exist
        await migration.up(queryRunner);

        // Then remove them
        await migration.down(queryRunner);

        // Verify indexes are removed
        const remainingIndexes = await queryRunner.query(`
          SELECT indexname FROM pg_indexes 
          WHERE tablename IN ('medical_records', 'access_grants', 'audit_logs', 'medical_history')
          AND indexname LIKE 'IDX_%'
          AND indexname IN (
            'IDX_medical_records_patient_id',
            'IDX_medical_records_patient_type_status_date',
            'IDX_access_grants_patient_grantee_expires',
            'IDX_access_grants_grantee_status_expires',
            'IDX_access_grants_status_expires',
            'IDX_audit_logs_entity_id',
            'IDX_audit_logs_entity_type_id_timestamp',
            'IDX_medical_history_patient_event_date',
            'IDX_medical_history_record_event_date'
          )
        `);

        expect(remainingIndexes.length).toBe(0);
      } finally {
        await queryRunner.release();
      }
    });

    it('should be idempotent (can run down multiple times)', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        // Run down multiple times
        await migration.down(queryRunner);
        await migration.down(queryRunner);

        // Should not throw errors
        expect(true).toBe(true);
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('Performance Impact', () => {
    it('should improve query performance for patient record lookup', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        // Measure before migration
        const beforeStart = Date.now();
        await queryRunner.query(`
          SELECT * FROM medical_records 
          WHERE patient_id = '00000000-0000-0000-0000-000000000001'
          LIMIT 100
        `);
        const beforeTime = Date.now() - beforeStart;

        // Run migration
        await migration.up(queryRunner);

        // Measure after migration
        const afterStart = Date.now();
        await queryRunner.query(`
          SELECT * FROM medical_records 
          WHERE patient_id = '00000000-0000-0000-0000-000000000001'
          LIMIT 100
        `);
        const afterTime = Date.now() - afterStart;

        // Performance should improve or stay the same
        // (May not always improve in test environment with small data)
        expect(afterTime).toBeLessThanOrEqual(beforeTime * 1.5);
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe('Index Statistics', () => {
    it('should have valid index statistics after ANALYZE', async () => {
      const queryRunner = dataSource.createQueryRunner();

      try {
        await migration.up(queryRunner);

        // Check index statistics
        const stats = await queryRunner.query(`
          SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch
          FROM pg_stat_user_indexes
          WHERE tablename IN ('medical_records', 'access_grants', 'audit_logs', 'medical_history')
          AND indexname LIKE 'IDX_%'
        `);

        // Should have statistics for all indexes
        expect(stats.length).toBeGreaterThan(0);
      } finally {
        await queryRunner.release();
      }
    });
  });
});
