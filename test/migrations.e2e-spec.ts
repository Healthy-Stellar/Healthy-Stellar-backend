import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/config/database.config';

/**
 * End-to-End Migration Tests
 * 
 * Tests that migrations can be applied and reverted successfully.
 * These tests require a test database to be available.
 */
describe('Database Migrations (e2e)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    // Use test database configuration
    const testConfig = {
      ...dataSourceOptions,
      database: process.env.DB_NAME_TEST || 'healthy_stellar_test',
      logging: false,
    };

    dataSource = new DataSource(testConfig);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('Migration Execution', () => {
    it('should initialize database connection', async () => {
      await dataSource.initialize();
      expect(dataSource.isInitialized).toBe(true);
    });

    it('should have migrations configured', () => {
      expect(dataSource.migrations).toBeDefined();
      expect(dataSource.migrations.length).toBeGreaterThan(0);
    });

    it('should run all pending migrations', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const migrations = await dataSource.runMigrations();
      expect(Array.isArray(migrations)).toBe(true);
    });

    it('should have created all base tables', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const queryRunner = dataSource.createQueryRunner();
      
      try {
        // Check if core tables exist
        const tables = [
          'users',
          'sessions',
          'mfa_devices',
          'medical_records',
          'access_grants',
          'audit_logs',
        ];

        for (const tableName of tables) {
          const hasTable = await queryRunner.hasTable(tableName);
          expect(hasTable).toBe(true);
        }
      } finally {
        await queryRunner.release();
      }
    });

    it('should have created required indexes', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const queryRunner = dataSource.createQueryRunner();
      
      try {
        // Check users table indexes
        const usersTable = await queryRunner.getTable('users');
        expect(usersTable).toBeDefined();
        
        const emailIndex = usersTable.indices.find(idx => idx.name === 'IDX_users_email');
        expect(emailIndex).toBeDefined();

        // Check medical_records table indexes
        const medicalRecordsTable = await queryRunner.getTable('medical_records');
        expect(medicalRecordsTable).toBeDefined();
        
        const patientIndex = medicalRecordsTable.indices.find(
          idx => idx.name === 'IDX_medical_records_patientId',
        );
        expect(patientIndex).toBeDefined();
      } finally {
        await queryRunner.release();
      }
    });

    it('should have created foreign key constraints', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const queryRunner = dataSource.createQueryRunner();
      
      try {
        // Check sessions -> users foreign key
        const sessionsTable = await queryRunner.getTable('sessions');
        expect(sessionsTable).toBeDefined();
        
        const userFk = sessionsTable.foreignKeys.find(
          fk => fk.name === 'FK_sessions_userId',
        );
        expect(userFk).toBeDefined();
        expect(userFk.columnNames).toContain('userId');
        expect(userFk.referencedTableName).toBe('users');
        expect(userFk.onDelete).toBe('CASCADE');

        // Check audit_logs -> users foreign key
        const auditLogsTable = await queryRunner.getTable('audit_logs');
        expect(auditLogsTable).toBeDefined();
        
        const auditUserFk = auditLogsTable.foreignKeys.find(
          fk => fk.name === 'FK_audit_logs_userId',
        );
        expect(auditUserFk).toBeDefined();
        expect(auditUserFk.onDelete).toBe('SET NULL');
      } finally {
        await queryRunner.release();
      }
    });

    it('should have enabled PostgreSQL extensions', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const result = await dataSource.query(`
        SELECT extname FROM pg_extension 
        WHERE extname IN ('uuid-ossp', 'pgcrypto')
      `);

      expect(result.length).toBe(2);
      const extensions = result.map(r => r.extname);
      expect(extensions).toContain('uuid-ossp');
      expect(extensions).toContain('pgcrypto');
    });

    it('should have created trigger functions', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const result = await dataSource.query(`
        SELECT proname FROM pg_proc 
        WHERE proname = 'update_updated_at_column'
      `);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should enforce synchronize: false', () => {
      expect(dataSource.options.synchronize).toBe(false);
    });
  });

  describe('Migration Rollback', () => {
    it('should revert last migration successfully', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      // Get current migrations
      const executedMigrations = await dataSource.query(
        'SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 1',
      );

      if (executedMigrations.length > 0) {
        await dataSource.undoLastMigration();
        
        // Verify migration was removed
        const afterRevert = await dataSource.query(
          'SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 1',
        );

        if (executedMigrations.length > 1) {
          expect(afterRevert[0].id).not.toBe(executedMigrations[0].id);
        }
      }
    });

    it('should be able to re-run migrations after revert', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const migrations = await dataSource.runMigrations();
      expect(Array.isArray(migrations)).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should enforce NOT NULL constraints', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      // Try to insert user without required fields
      await expect(
        dataSource.query(`
          INSERT INTO users (email, "passwordHash") 
          VALUES (NULL, 'test')
        `),
      ).rejects.toThrow();
    });

    it('should enforce UNIQUE constraints', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const testEmail = `test-${Date.now()}@example.com`;

      // Insert first user
      await dataSource.query(`
        INSERT INTO users (email, "passwordHash", role) 
        VALUES ($1, 'hash', 'patient')
      `, [testEmail]);

      // Try to insert duplicate email
      await expect(
        dataSource.query(`
          INSERT INTO users (email, "passwordHash", role) 
          VALUES ($1, 'hash', 'patient')
        `, [testEmail]),
      ).rejects.toThrow();
    });

    it('should enforce ENUM constraints', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      // Try to insert invalid role
      await expect(
        dataSource.query(`
          INSERT INTO users (email, "passwordHash", role) 
          VALUES ('test@example.com', 'hash', 'invalid_role')
        `),
      ).rejects.toThrow();
    });

    it('should cascade delete on foreign key constraints', async () => {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      // Create a user
      const userResult = await dataSource.query(`
        INSERT INTO users (email, "passwordHash", role) 
        VALUES ($1, 'hash', 'patient')
        RETURNING id
      `, [`cascade-test-${Date.now()}@example.com`]);

      const userId = userResult[0].id;

      // Create a session for the user
      await dataSource.query(`
        INSERT INTO sessions ("userId", "refreshToken", "accessToken", "expiresAt") 
        VALUES ($1, $2, $3, NOW() + INTERVAL '1 day')
      `, [userId, `refresh-${Date.now()}`, `access-${Date.now()}`]);

      // Delete the user
      await dataSource.query('DELETE FROM users WHERE id = $1', [userId]);

      // Verify session was also deleted (CASCADE)
      const sessions = await dataSource.query(
        'SELECT * FROM sessions WHERE "userId" = $1',
        [userId],
      );

      expect(sessions.length).toBe(0);
    });
  });
});
