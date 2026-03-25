import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';

describe('Emergency Access (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let doctorToken: string;
  let patientToken: string;
  let adminToken: string;
  let patientId: string;
  let doctorId: string;
  let recordId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Create test users
    const doctorRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'doctor@test.com',
        password: 'Test123!@#',
        role: 'physician',
      });
    doctorId = doctorRes.body.userId;
    doctorToken = doctorRes.body.accessToken;

    const patientRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'patient@test.com',
        password: 'Test123!@#',
        role: 'patient',
      });
    patientId = patientRes.body.userId;
    patientToken = patientRes.body.accessToken;

    const adminRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@test.com',
        password: 'Test123!@#',
        role: 'admin',
      });
    adminToken = adminRes.body.accessToken;

    // Create a test record
    const recordRes = await request(app.getHttpServer())
      .post('/records')
      .set('Authorization', `Bearer ${patientToken}`)
      .field('patientId', patientId)
      .field('recordType', 'MEDICAL_REPORT')
      .field('description', 'Test record')
      .attach('file', Buffer.from('encrypted data'), 'test.enc');
    recordId = recordRes.body.recordId;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM access_grants');
    await dataSource.query('DELETE FROM audit_logs');
    await dataSource.query('DELETE FROM records');
    await dataSource.query('DELETE FROM users');
    await app.close();
  });

  describe('POST /access/emergency', () => {
    it('should create emergency access grant with valid reason', async () => {
      const response = await request(app.getHttpServer())
        .post('/access/emergency')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId,
          emergencyReason: 'Patient arrived unconscious in ER with severe trauma. Immediate access to medical history required for life-saving treatment.',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.isEmergency).toBe(true);
      expect(response.body.patientId).toBe(patientId);
      expect(response.body.granteeId).toBe(doctorId);
      expect(response.body.accessLevel).toBe('READ_WRITE');
      expect(response.body.recordIds).toEqual(['*']);
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.expiresAt).toBeDefined();

      // Verify expiration is ~24 hours
      const expiresAt = new Date(response.body.expiresAt);
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(25 * 60 * 60 * 1000);
    });

    it('should reject emergency access with short reason', async () => {
      await request(app.getHttpServer())
        .post('/access/emergency')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId,
          emergencyReason: 'Too short',
        })
        .expect(400);
    });

    it('should reject emergency access without DOCTOR or ADMIN role', async () => {
      await request(app.getHttpServer())
        .post('/access/emergency')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          patientId,
          emergencyReason: 'Patient arrived unconscious in ER with severe trauma. Immediate access to medical history required.',
        })
        .expect(403);
    });
  });

  describe('GET /access/emergency-log', () => {
    it('should allow patient to view emergency access history', async () => {
      const response = await request(app.getHttpServer())
        .get('/access/emergency-log')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].isEmergency).toBe(true);
      expect(response.body[0].emergencyReason).toBeDefined();
    });
  });

  describe('PATCH /users/:id/emergency-access', () => {
    it('should allow admin to disable emergency access', async () => {
      await request(app.getHttpServer())
        .patch(`/users/${patientId}/emergency-access`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false })
        .expect(200);

      // Verify emergency access is blocked
      await request(app.getHttpServer())
        .post('/access/emergency')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId,
          emergencyReason: 'Patient arrived unconscious in ER with severe trauma. Immediate access to medical history required.',
        })
        .expect(403);
    });

    it('should allow admin to re-enable emergency access', async () => {
      await request(app.getHttpServer())
        .patch(`/users/${patientId}/emergency-access`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: true })
        .expect(200);
    });

    it('should reject non-admin users', async () => {
      await request(app.getHttpServer())
        .patch(`/users/${patientId}/emergency-access`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ enabled: false })
        .expect(403);
    });
  });

  describe('Emergency Access Audit Logging', () => {
    it('should flag record reads under emergency access as EMERGENCY_ACCESS', async () => {
      // Create emergency access
      await request(app.getHttpServer())
        .post('/access/emergency')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId,
          emergencyReason: 'Critical emergency requiring immediate access to patient medical records for treatment.',
        })
        .expect(201);

      // Read record under emergency access
      await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      // Verify audit log
      const auditLogs = await dataSource.query(
        `SELECT * FROM audit_logs WHERE operation = 'EMERGENCY_ACCESS' AND entity_id = $1`,
        [recordId],
      );

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].operation).toBe('EMERGENCY_ACCESS');
      expect(auditLogs[0].entity_type).toBe('records');
      expect(auditLogs[0].user_id).toBe(doctorId);
    });
  });

  describe('Emergency Access Expiration', () => {
    it('should expire emergency grants after 24 hours', async () => {
      // Create emergency access
      const grantRes = await request(app.getHttpServer())
        .post('/access/emergency')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId,
          emergencyReason: 'Critical emergency requiring immediate access to patient medical records for treatment.',
        })
        .expect(201);

      const grantId = grantRes.body.id;

      // Manually expire the grant
      await dataSource.query(
        `UPDATE access_grants SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1`,
        [grantId],
      );

      // Trigger cleanup
      const accessControlService = app.get('AccessControlService');
      await accessControlService.expireEmergencyGrants();

      // Verify grant is expired
      const grant = await dataSource.query(`SELECT * FROM access_grants WHERE id = $1`, [grantId]);
      expect(grant[0].status).toBe('EXPIRED');
    });
  });
});
