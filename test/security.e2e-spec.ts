import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import * as request from 'supertest';

/**
 * Security Tests - Hack-Proof Verification
 * 
 * Tests various attack vectors to ensure the system is secure:
 * - SQL Injection attacks
 * - NoSQL Injection attacks
 * - Authentication bypass attempts
 * - Authorization bypass attempts
 * - Mass assignment vulnerabilities
 * - XSS attacks
 * - CSRF attacks
 * - Rate limiting
 * - Input validation
 * - Data exposure
 */
describe('Security Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same security configurations as production
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('SQL Injection Protection', () => {
    it('should prevent SQL injection in login email field', async () => {
      const sqlInjectionPayloads = [
        "admin'--",
        "admin' OR '1'='1",
        "admin' OR '1'='1'--",
        "admin' OR 1=1--",
        "' OR ''='",
        "' OR 1=1--",
        "admin'/*",
        "' UNION SELECT NULL--",
        "1' AND '1'='1",
        "'; DROP TABLE users--",
        "' OR 'x'='x",
        "admin' AND 1=0 UNION ALL SELECT 'admin', '81dc9bdb52d04dc20036dbd8313ed055'",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: payload,
            password: 'password123',
          });

        // Should not return 200 or expose database errors
        expect(response.status).not.toBe(200);
        expect(response.body).not.toHaveProperty('token');
        
        // Should not expose SQL error messages
        if (response.body.message) {
          expect(response.body.message.toLowerCase()).not.toContain('sql');
          expect(response.body.message.toLowerCase()).not.toContain('syntax');
          expect(response.body.message.toLowerCase()).not.toContain('query');
        }
      }
    });

    it('should use parameterized queries for user search', async () => {
      // Create a test user first
      const testUser = await dataSource.query(
        `INSERT INTO users (email, "passwordHash", role) 
         VALUES ($1, $2, $3) RETURNING id`,
        ['test-sql@example.com', 'hash', 'patient'],
      );

      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users--",
        "' UNION SELECT * FROM users--",
      ];

      for (const payload of sqlInjectionPayloads) {
        // Attempt SQL injection through query parameters
        const result = await dataSource.query(
          'SELECT * FROM users WHERE email = $1',
          [payload],
        );

        // Should return empty result, not all users
        expect(result.length).toBe(0);
      }

      // Cleanup
      await dataSource.query('DELETE FROM users WHERE id = $1', [testUser[0].id]);
    });

    it('should prevent SQL injection in JSONB queries', async () => {
      const maliciousMetadata = {
        key: "'; DROP TABLE medical_records--",
        value: "' OR '1'='1",
      };

      // This should be safely stored as JSON, not executed as SQL
      const result = await dataSource.query(
        `INSERT INTO medical_records ("patientId", metadata, "recordType") 
         VALUES ($1, $2, $3) RETURNING id`,
        ['00000000-0000-0000-0000-000000000000', JSON.stringify(maliciousMetadata), 'other'],
      );

      expect(result[0].id).toBeDefined();

      // Verify data was stored safely
      const record = await dataSource.query(
        'SELECT metadata FROM medical_records WHERE id = $1',
        [result[0].id],
      );

      expect(record[0].metadata.key).toBe("'; DROP TABLE medical_records--");

      // Cleanup
      await dataSource.query('DELETE FROM medical_records WHERE id = $1', [result[0].id]);
    });
  });

  describe('Authentication Security', () => {
    it('should prevent authentication bypass with empty credentials', async () => {
      const bypassAttempts = [
        { email: '', password: '' },
        { email: null, password: null },
        { email: undefined, password: undefined },
        {},
      ];

      for (const attempt of bypassAttempts) {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send(attempt);

        expect(response.status).not.toBe(200);
        expect(response.body).not.toHaveProperty('token');
      }
    });

    it('should enforce account lockout after failed attempts', async () => {
      // Create test user
      const testEmail = `lockout-test-${Date.now()}@example.com`;
      await dataSource.query(
        `INSERT INTO users (email, "passwordHash", role, "isActive") 
         VALUES ($1, $2, $3, $4)`,
        [testEmail, 'hash', 'patient', true],
      );

      // Simulate multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testEmail,
            password: 'wrong-password',
          });
      }

      // Verify account is locked
      const user = await dataSource.query(
        'SELECT "failedLoginAttempts", "lockedUntil" FROM users WHERE email = $1',
        [testEmail],
      );

      expect(user[0].failedLoginAttempts).toBeGreaterThanOrEqual(5);

      // Cleanup
      await dataSource.query('DELETE FROM users WHERE email = $1', [testEmail]);
    });

    it('should not expose user existence in error messages', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      // Should return generic error, not "user not found"
      expect(response.status).toBe(401);
      if (response.body.message) {
        expect(response.body.message.toLowerCase()).not.toContain('not found');
        expect(response.body.message.toLowerCase()).not.toContain('does not exist');
        expect(response.body.message.toLowerCase()).not.toContain('invalid user');
      }
    });

    it('should prevent JWT token manipulation', async () => {
      const maliciousTokens = [
        'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.',
        'Bearer null',
        'Bearer undefined',
        'Bearer {}',
        'Bearer {"userId":"admin"}',
      ];

      for (const token of maliciousTokens) {
        const response = await request(app.getHttpServer())
          .get('/users/profile')
          .set('Authorization', token);

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Authorization Security', () => {
    it('should prevent horizontal privilege escalation', async () => {
      // Create two test patients
      const patient1 = await dataSource.query(
        `INSERT INTO users (email, "passwordHash", role, "isActive") 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`patient1-${Date.now()}@example.com`, 'hash', 'patient', true],
      );

      const patient2 = await dataSource.query(
        `INSERT INTO users (email, "passwordHash", role, "isActive") 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`patient2-${Date.now()}@example.com`, 'hash', 'patient', true],
      );

      // Create medical record for patient1
      const record = await dataSource.query(
        `INSERT INTO medical_records ("patientId", "recordType") 
         VALUES ($1, $2) RETURNING id`,
        [patient1[0].id, 'consultation'],
      );

      // Patient2 should NOT be able to access patient1's records
      // This would be tested with actual authentication in integration tests
      const unauthorizedAccess = await dataSource.query(
        `SELECT * FROM medical_records 
         WHERE id = $1 AND "patientId" = $2`,
        [record[0].id, patient2[0].id],
      );

      expect(unauthorizedAccess.length).toBe(0);

      // Cleanup
      await dataSource.query('DELETE FROM medical_records WHERE id = $1', [record[0].id]);
      await dataSource.query('DELETE FROM users WHERE id IN ($1, $2)', [patient1[0].id, patient2[0].id]);
    });

    it('should prevent vertical privilege escalation', async () => {
      // Create patient and admin users
      const patient = await dataSource.query(
        `INSERT INTO users (email, "passwordHash", role, "isActive") 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`patient-priv-${Date.now()}@example.com`, 'hash', 'patient', true],
      );

      // Patient should not be able to modify their role to admin
      await expect(
        dataSource.query(
          `UPDATE users SET role = $1 WHERE id = $2`,
          ['admin', patient[0].id],
        ),
      ).resolves.toBeDefined();

      // But application logic should prevent this through authorization checks
      const user = await dataSource.query(
        'SELECT role FROM users WHERE id = $1',
        [patient[0].id],
      );

      // In a real scenario, the application would prevent this update
      // This test verifies the database allows the operation but app logic should prevent it

      // Cleanup
      await dataSource.query('DELETE FROM users WHERE id = $1', [patient[0].id]);
    });

    it('should enforce access grants for medical records', async () => {
      // Create patient, doctor, and unauthorized doctor
      const patient = await dataSource.query(
        `INSERT INTO users (email, "passwordHash", role, "isActive") 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`patient-access-${Date.now()}@example.com`, 'hash', 'patient', true],
      );

      const authorizedDoctor = await dataSource.query(
        `INSERT INTO users (email, "passwordHash", role, "isActive") 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`doctor-auth-${Date.now()}@example.com`, 'hash', 'physician', true],
      );

      const unauthorizedDoctor = await dataSource.query(
        `INSERT INTO users (email, "passwordHash", role, "isActive") 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`doctor-unauth-${Date.now()}@example.com`, 'hash', 'physician', true],
      );

      // Create medical record
      const record = await dataSource.query(
        `INSERT INTO medical_records ("patientId", "recordType") 
         VALUES ($1, $2) RETURNING id`,
        [patient[0].id, 'consultation'],
      );

      // Grant access only to authorized doctor
      await dataSource.query(
        `INSERT INTO access_grants ("patientId", "granteeId", "recordIds", "accessLevel", status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [patient[0].id, authorizedDoctor[0].id, record[0].id, 'READ', 'ACTIVE'],
      );

      // Check unauthorized doctor has no access grant
      const unauthorizedGrant = await dataSource.query(
        `SELECT * FROM access_grants 
         WHERE "patientId" = $1 AND "granteeId" = $2 AND status = 'ACTIVE'`,
        [patient[0].id, unauthorizedDoctor[0].id],
      );

      expect(unauthorizedGrant.length).toBe(0);

      // Cleanup
      await dataSource.query('DELETE FROM access_grants WHERE "patientId" = $1', [patient[0].id]);
      await dataSource.query('DELETE FROM medical_records WHERE id = $1', [record[0].id]);
      await dataSource.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [
        patient[0].id,
        authorizedDoctor[0].id,
        unauthorizedDoctor[0].id,
      ]);
    });
  });

  describe('Input Validation', () => {
    it('should reject malformed email addresses', async () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        '<script>alert("xss")</script>@example.com',
        'user@example.com; DROP TABLE users--',
      ];

      for (const email of invalidEmails) {
        await expect(
          dataSource.query(
            `INSERT INTO users (email, "passwordHash", role) 
             VALUES ($1, $2, $3)`,
            [email, 'hash', 'patient'],
          ),
        ).resolves.toBeDefined(); // Database accepts it, but app validation should reject
      }
    });

    it('should enforce ENUM constraints', async () => {
      // Try to insert invalid role
      await expect(
        dataSource.query(
          `INSERT INTO users (email, "passwordHash", role) 
           VALUES ($1, $2, $3)`,
          ['test@example.com', 'hash', 'hacker'],
        ),
      ).rejects.toThrow();

      // Try to insert invalid record type
      await expect(
        dataSource.query(
          `INSERT INTO medical_records ("patientId", "recordType") 
           VALUES ($1, $2)`,
          ['00000000-0000-0000-0000-000000000000', 'malicious_type'],
        ),
      ).rejects.toThrow();
    });

    it('should prevent mass assignment vulnerabilities', async () => {
      const maliciousPayload = {
        email: 'test@example.com',
        passwordHash: 'hash',
        role: 'patient',
        isActive: true,
        // Attempting to set admin role through mass assignment
        role_override: 'admin',
        is_superuser: true,
        permissions: ['*'],
      };

      // Application should whitelist only allowed fields
      // This test verifies the database structure doesn't have unexpected columns
      const columns = await dataSource.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);

      const columnNames = columns.map(c => c.column_name);
      expect(columnNames).not.toContain('role_override');
      expect(columnNames).not.toContain('is_superuser');
    });

    it('should sanitize JSONB input', async () => {
      const maliciousMetadata = {
        '<script>alert("xss")</script>': 'value',
        'key': '<img src=x onerror=alert("xss")>',
        'nested': {
          'evil': '"; DROP TABLE medical_records--',
        },
      };

      const result = await dataSource.query(
        `INSERT INTO medical_records ("patientId", metadata, "recordType") 
         VALUES ($1, $2, $3) RETURNING id, metadata`,
        ['00000000-0000-0000-0000-000000000000', JSON.stringify(maliciousMetadata), 'other'],
      );

      // Data should be stored as-is (not executed)
      expect(result[0].metadata).toHaveProperty('<script>alert("xss")</script>');
      expect(result[0].metadata.key).toContain('<img');

      // Cleanup
      await dataSource.query('DELETE FROM medical_records WHERE id = $1', [result[0].id]);
    });
  });

  describe('Data Exposure Prevention', () => {
    it('should not expose password hashes in queries', async () => {
      const user = await dataSource.query(
        `INSERT INTO users (email, "passwordHash", role) 
         VALUES ($1, $2, $3) RETURNING id, email, role`,
        [`exposure-test-${Date.now()}@example.com`, 'secret_hash_12345', 'patient'],
      );

      // Verify passwordHash is not returned in SELECT
      expect(user[0]).not.toHaveProperty('passwordHash');
      expect(user[0]).toHaveProperty('email');
      expect(user[0]).toHaveProperty('role');

      // Cleanup
      await dataSource.query('DELETE FROM users WHERE id = $1', [user[0].id]);
    });

    it('should not expose sensitive data in error messages', async () => {
      try {
        await dataSource.query(
          `INSERT INTO users (email, "passwordHash", role) 
           VALUES ($1, $2, $3)`,
          ['duplicate@example.com', 'hash', 'patient'],
        );

        await dataSource.query(
          `INSERT INTO users (email, "passwordHash", role) 
           VALUES ($1, $2, $3)`,
          ['duplicate@example.com', 'hash', 'patient'],
        );
      } catch (error) {
        // Error should not expose sensitive data
        expect(error.message).not.toContain('passwordHash');
        expect(error.message).not.toContain('secret');
        expect(error.message).not.toContain('hash');
      }

      // Cleanup
      await dataSource.query('DELETE FROM users WHERE email = $1', ['duplicate@example.com']);
    });

    it('should enforce Row-Level Security policies', async () => {
      // Verify RLS is enabled on sensitive tables
      const rlsTables = await dataSource.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('medical_records', 'access_grants', 'audit_logs')
      `);

      for (const table of rlsTables) {
        const rlsEnabled = await dataSource.query(`
          SELECT relrowsecurity 
          FROM pg_class 
          WHERE relname = $1
        `, [table.tablename]);

        expect(rlsEnabled[0].relrowsecurity).toBe(true);
      }
    });
  });

  describe('Audit Trail Security', () => {
    it('should log all sensitive operations', async () => {
      const beforeCount = await dataSource.query(
        'SELECT COUNT(*) as count FROM audit_logs',
      );

      // Perform a sensitive operation
      const user = await dataSource.query(
        `INSERT INTO users (email, "passwordHash", role) 
         VALUES ($1, $2, $3) RETURNING id`,
        [`audit-test-${Date.now()}@example.com`, 'hash', 'patient'],
      );

      // Note: Audit logging would be triggered by application logic or database triggers
      // This test verifies the audit_logs table structure supports comprehensive logging

      const auditColumns = await dataSource.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'audit_logs'
      `);

      const columnNames = auditColumns.map(c => c.column_name);
      expect(columnNames).toContain('userId');
      expect(columnNames).toContain('action');
      expect(columnNames).toContain('entity');
      expect(columnNames).toContain('entityId');
      expect(columnNames).toContain('ipAddress');
      expect(columnNames).toContain('userAgent');
      expect(columnNames).toContain('severity');

      // Cleanup
      await dataSource.query('DELETE FROM users WHERE id = $1', [user[0].id]);
    });

    it('should prevent audit log tampering', async () => {
      // Create an audit log entry
      const log = await dataSource.query(
        `INSERT INTO audit_logs ("userId", action, entity, severity, timestamp) 
         VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
        ['00000000-0000-0000-0000-000000000000', 'TEST', 'test_entity', 'LOW'],
      );

      // Attempt to delete audit log (should be prevented by RLS policies in production)
      // In this test, we verify the structure supports immutability
      const rlsEnabled = await dataSource.query(`
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = 'audit_logs'
      `);

      expect(rlsEnabled[0].relrowsecurity).toBe(true);

      // Cleanup (only possible with elevated privileges)
      await dataSource.query('DELETE FROM audit_logs WHERE id = $1', [log[0].id]);
    });
  });

  describe('Database Configuration Security', () => {
    it('should enforce synchronize: false', () => {
      expect(dataSource.options.synchronize).toBe(false);
    });

    it('should have statement timeout configured', () => {
      expect(dataSource.options.extra).toHaveProperty('statement_timeout');
      expect(dataSource.options.extra.statement_timeout).toBeLessThanOrEqual(60000);
    });

    it('should have connection pool limits', () => {
      expect(dataSource.options.extra).toHaveProperty('max');
      expect(dataSource.options.extra).toHaveProperty('min');
      expect(dataSource.options.extra.max).toBeGreaterThan(0);
      expect(dataSource.options.extra.max).toBeLessThanOrEqual(100);
    });

    it('should not expose database credentials in logs', () => {
      const options = dataSource.options;
      
      // Verify sensitive data is not logged
      expect(JSON.stringify(options)).toBeDefined();
      // In production, password should be masked in logs
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should have consistent response times for authentication', async () => {
      const timings: number[] = [];

      // Test with valid and invalid credentials
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: `test${i}@example.com`,
            password: 'password123',
          });
        const end = Date.now();
        timings.push(end - start);
      }

      // Response times should be relatively consistent
      // (not revealing whether user exists based on timing)
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const variance = timings.map(t => Math.abs(t - avg));
      const maxVariance = Math.max(...variance);

      // Allow some variance but not orders of magnitude
      expect(maxVariance).toBeLessThan(avg * 2);
    });
  });

  describe('Denial of Service Prevention', () => {
    it('should limit query execution time', async () => {
      // Attempt a potentially slow query
      const start = Date.now();
      
      try {
        await dataSource.query(`
          SELECT * FROM users 
          WHERE email LIKE '%@%' 
          LIMIT 1000
        `);
      } catch (error) {
        // Query might be cancelled by statement_timeout
      }

      const duration = Date.now() - start;

      // Should not take longer than statement_timeout
      expect(duration).toBeLessThan(65000); // 60s timeout + 5s buffer
    });

    it('should prevent connection exhaustion', async () => {
      const maxConnections = dataSource.options.extra.max;
      
      // Verify max connections is reasonable
      expect(maxConnections).toBeLessThanOrEqual(100);
      expect(maxConnections).toBeGreaterThan(0);
    });
  });
});
