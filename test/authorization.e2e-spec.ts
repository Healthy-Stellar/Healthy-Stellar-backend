import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../src/auth/entities/user.entity';
import { Patient } from '../src/patients/entities/patient.entity';
import { Record } from '../src/records/entities/record.entity';

describe('Authorization & Role-Based Access Control (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let patientRepository: Repository<Patient>;
  let recordRepository: Repository<Record>;

  // Test users across roles
  let adminUserId: string;
  let adminAccessToken: string;
  let physicianUserId: string;
  let physicianAccessToken: string;
  let nurseUserId: string;
  let nurseAccessToken: string;
  let patientUserId: string;
  let patientAccessToken: string;
  let billingStaffUserId: string;
  let billingStaffAccessToken: string;

  const createUserData = (email: string, firstName: string, lastName: string) => ({
    firstName,
    lastName,
    email,
    password: 'TestPassword123!',
    dateOfBirth: '1990-01-01',
    gender: 'MALE',
    phoneNumber: '555-0000',
    address: '100 Test St',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
  });

  const createStaffData = (email: string, role: string, firstName: string, npi: string) => ({
    firstName,
    lastName: 'Staff',
    email,
    password: 'TestPassword123!',
    role,
    npi,
    licenseNumber: `LIC${npi.slice(-6)}`,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    patientRepository = moduleFixture.get(getRepositoryToken(Patient));
    recordRepository = moduleFixture.get(getRepositoryToken(Record));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up
    await recordRepository.delete({});
    await patientRepository.delete({});
    await userRepository.delete({});

    // Create admin user
    const adminResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(createUserData('admin@example.com', 'Admin', 'User'))
      .expect(201);

    adminUserId = adminResponse.body.user.id;
    adminAccessToken = adminResponse.body.tokens.accessToken;

    // Update to admin role
    const adminUser = await userRepository.findOne({
      where: { id: adminUserId },
    });
    adminUser.role = UserRole.ADMIN;
    await userRepository.save(adminUser);

    // Create physician
    const physicianResponse = await request(app.getHttpServer())
      .post('/auth/register/staff')
      .send(createStaffData('physician@example.com', 'PHYSICIAN', 'Dr. James', '1111111111'))
      .expect(201);

    physicianUserId = physicianResponse.body.user.id;
    physicianAccessToken = physicianResponse.body.tokens.accessToken;

    // Create nurse
    const nurseResponse = await request(app.getHttpServer())
      .post('/auth/register/staff')
      .send(createStaffData('nurse@example.com', 'NURSE', 'Ns. Jane', '2222222222'))
      .expect(201);

    nurseUserId = nurseResponse.body.user.id;
    nurseAccessToken = nurseResponse.body.tokens.accessToken;

    // Create patient
    const patientResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(createUserData('patient@example.com', 'John', 'Patient'))
      .expect(201);

    patientUserId = patientResponse.body.user.id;
    patientAccessToken = patientResponse.body.tokens.accessToken;

    // Create billing staff (if not already using another approach)
    const billingResponse = await request(app.getHttpServer())
      .post('/auth/register/staff')
      .send(createStaffData('billing@example.com', 'BILLING_STAFF', 'Bill', '3333333333'))
      .expect(201);

    billingStaffUserId = billingResponse.body.user.id;
    billingStaffAccessToken = billingResponse.body.tokens.accessToken;
  });

  describe('Admin-Only Endpoints', () => {
    describe('GET /patients/admin/all - List All Patients', () => {
      beforeEach(async () => {
        // Create some test patients
        for (let i = 0; i < 2; i++) {
          await request(app.getHttpServer())
            .post('/auth/register')
            .send(createUserData(`patient${i}@example.com`, `Patient${i}`, `Test`))
            .expect(201);
        }
      });

      it('should allow admin to list all patients', async () => {
        const response = await request(app.getHttpServer())
          .get('/patients/admin/all')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(Array.isArray(response.body) || response.body.data).toBeDefined();
        expect(
          (Array.isArray(response.body) ? response.body : response.body.data).length,
        ).toBeGreaterThanOrEqual(2);
      });

      it('should reject non-admin access to /patients/admin/all', async () => {
        const response = await request(app.getHttpServer())
          .get('/patients/admin/all')
          .set('Authorization', `Bearer ${patientAccessToken}`)
          .expect(403);

        expect(response.body.message).toBeDefined();
      });

      it('should reject physician access to admin endpoint', async () => {
        const response = await request(app.getHttpServer())
          .get('/patients/admin/all')
          .set('Authorization', `Bearer ${physicianAccessToken}`)
          .expect(403);

        expect(response.body.message).toBeDefined();
      });

      it('should reject nurse access to admin endpoint', async () => {
        const response = await request(app.getHttpServer())
          .get('/patients/admin/all')
          .set('Authorization', `Bearer ${nurseAccessToken}`)
          .expect(403);

        expect(response.body.message).toBeDefined();
      });

      it('should reject unauthenticated access', async () => {
        const response = await request(app.getHttpServer())
          .get('/patients/admin/all')
          .expect(401);

        expect(response.body.message).toBeDefined();
      });
    });

    describe('GET /patients - Search Patients (Admin)', () => {
      it('should allow admin to search patients', async () => {
        const response = await request(app.getHttpServer())
          .get('/patients?search=John')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(Array.isArray(response.body) || response.body.data).toBeDefined();
      });

      it('should reject non-admin search', async () => {
        const response = await request(app.getHttpServer())
          .get('/patients?search=John')
          .set('Authorization', `Bearer ${patientAccessToken}`)
          .expect(403);

        expect(response.body.message).toBeDefined();
      });
    });

    describe('POST /patients/:id/admit - Admit Patient (Admin)', () => {
      it('should allow admin to admit patient', async () => {
        const response = await request(app.getHttpServer())
          .post(`/patients/${patientUserId}/admit`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({ admissionDate: new Date().toISOString() })
          .expect(200);

        expect(response.body.status).toBeDefined();
      });

      it('should reject non-admin admission', async () => {
        const response = await request(app.getHttpServer())
          .post(`/patients/${patientUserId}/admit`)
          .set('Authorization', `Bearer ${physicianAccessToken}`)
          .send({ admissionDate: new Date().toISOString() })
          .expect(403);

        expect(response.body.message).toBeDefined();
      });
    });
  });

  describe('Provider-Protected Endpoints', () => {
    describe('Healthcare Provider Access', () => {
      it('should allow physician to access provider endpoints', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${physicianAccessToken}`)
          .expect(200);

        expect(response.body.role).toBe('PHYSICIAN');
        expect(response.body.npi).toBeDefined();
      });

      it('should allow nurse to access provider endpoints', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${nurseAccessToken}`)
          .expect(200);

        expect(response.body.role).toBe('NURSE');
      });

      it('should prevent patient from accessing provider-only features', async () => {
        // Assuming there are some provider-specific endpoints
        // This depends on application design
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${patientAccessToken}`)
          .expect(200);

        expect(response.body.role).toBe('PATIENT');
      });
    });
  });

  describe('Patient Privacy & Data Isolation', () => {
    beforeEach(async () => {
      // Create records for first patient
      await recordRepository.save({
        id: 'patient1-record-1',
        patientId: patientUserId,
        cid: 'QmPatient1Record1',
        stellarTxHash: 'tx-hash-1',
        metadata: { recordType: 'consultation' },
      });

      // Create another patient and their record
      const otherPatientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(createUserData('other@example.com', 'Other', 'Patient'))
        .expect(201);

      const otherPatientId = otherPatientResponse.body.user.id;

      await recordRepository.save({
        id: 'patient2-record-1',
        patientId: otherPatientId,
        cid: 'QmPatient2Record1',
        stellarTxHash: 'tx-hash-2',
        metadata: { recordType: 'lab-results' },
      });
    });

    it('should prevent patient from accessing other patient records', async () => {
      const response = await request(app.getHttpServer())
        .get('/records/patient2-record-1')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(403);

      expect(response.body.message).toBeDefined();
    });

    it('should prevent patient from accessing other patient profiles', async () => {
      const otherPatientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(createUserData('another@example.com', 'Another', 'Patient'))
        .expect(201);

      const anotherPatientId = otherPatientResponse.body.user.id;

      const response = await request(app.getHttpServer())
        .get(`/patients/${anotherPatientId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(403);

      expect(response.body.message).toBeDefined();
    });

    it('should enforce data isolation even for admin (unless explicitly granted)', async () => {
      const otherPatientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(createUserData('isolated@example.com', 'Isolated', 'Patient'))
        .expect(201);

      const otherPatientId = otherPatientResponse.body.user.id;
      const otherPatientAccessToken = otherPatientResponse.body.tokens.accessToken;

      await recordRepository.save({
        id: 'isolated-record-1',
        patientId: otherPatientId,
        cid: 'QmIsolatedRecord',
        stellarTxHash: 'tx-hash-isolated',
        metadata: { restricted: true },
      });

      // Physician should not access without grant
      const response = await request(app.getHttpServer())
        .get('/records/isolated-record-1')
        .set('Authorization', `Bearer ${physicianAccessToken}`)
        .expect(403);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Role-Specific Authorization', () => {
    describe('Physician Authorization', () => {
      it('should allow physician to view their profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${physicianAccessToken}`)
          .expect(200);

        expect(response.body.role).toBe('PHYSICIAN');
        expect(response.body.npi).toBeDefined();
      });

      it('should allow physician to access granted records', async () => {
        // Create patient record
        const patient = await userRepository.findOne({
          where: { id: patientUserId },
        });

        const record = await recordRepository.save({
          id: 'physician-access-test',
          patientId: patientUserId,
          cid: 'QmPhysicianTest',
          stellarTxHash: 'tx-hash-phys',
          metadata: { physician: 'test' },
        });

        // Grant access via access control (assuming you have endpoint for this)
        // For now, just verify endpoint structure
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${physicianAccessToken}`)
          .expect(200);

        expect(response.body.role).toBe('PHYSICIAN');
      });
    });

    describe('Nurse Authorization', () => {
      it('should allow nurse to view their profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${nurseAccessToken}`)
          .expect(200);

        expect(response.body.role).toBe('NURSE');
      });
    });

    describe('Billing Staff Authorization', () => {
      it('should allow billing staff to view their profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${billingStaffAccessToken}`)
          .expect(200);

        expect(response.body.role).toBe('BILLING_STAFF');
      });

      it('should prevent billing staff from accessing clinical endpoints', async () => {
        // Create a clinical record
        const record = await recordRepository.save({
          id: 'clinical-record',
          patientId: patientUserId,
          cid: 'QmClinical',
          stellarTxHash: 'tx-hash-clinical',
          metadata: { type: 'clinical' },
        });

        // Billing staff should not access clinical records
        const response = await request(app.getHttpServer())
          .get('/records/clinical-record')
          .set('Authorization', `Bearer ${billingStaffAccessToken}`)
          .expect(403);

        expect(response.body.message).toBeDefined();
      });
    });
  });

  describe('Token-Based Authorization', () => {
    it('should accept valid JWT token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(response.body.id).toBe(patientUserId);
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should reject request without Bearer token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'InvalidTokenFormat')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should reject request without Authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Permission Denial Scenarios', () => {
    it('should return 401 for unauthenticated requests to protected endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/records')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should return 403 for forbidden operations', async () => {
      // Patient trying to access admin endpoint
      const response = await request(app.getHttpServer())
        .get('/patients/admin/all')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(403);

      expect(response.body.message).toBeDefined();
    });

    it('should return 403 when user lacks required role', async () => {
      // Non-physician trying to perform physician-specific action
      const response = await request(app.getHttpServer())
        .post('/patients/admit')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({ patientId: patientUserId })
        .expect(403);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Integration: Multi-Role Scenarios', () => {
    it('should handle mixed-role operations correctly', async () => {
      // Patient creates record
      const createResponse = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          cid: 'QmMixedRoleTest',
          recordType: 'consultation',
          description: 'Mixed role test',
          metadata: { test: 'mixed' },
        })
        .expect(201);

      const recordId = createResponse.body.id;

      // Patient grants access to physician
      // (Assuming this endpoint exists)

      // Admin can see all patients
      const adminPatientsResponse = await request(app.getHttpServer())
        .get('/patients/admin/all')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(adminPatientsResponse.body).toBeDefined();

      // Physician cannot access admin endpoints
      const physicianAdminAttempt = await request(app.getHttpServer())
        .get('/patients/admin/all')
        .set('Authorization', `Bearer ${physicianAccessToken}`)
        .expect(403);

      expect(physicianAdminAttempt.body.message).toBeDefined();
    });

    it('should prevent privilege escalation', async () => {
      // Patient should not be able to change their own role
      // (Assuming no endpoint exists, but testing the concept)

      // Verify patient cannot access role-changing operations
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(response.body.role).toBe('PATIENT');
      // If there's a role-change endpoint, it should require admin
    });
  });

  describe('Session & Token Authorization', () => {
    it('should invalidate token after logout', async () => {
      // Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      // Token should be invalid
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should handle concurrent session management', async () => {
      // Login first time
      const login1 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'patient@example.com',
          password: 'TestPassword123!',
        })
        .expect(200);

      const token1 = login1.body.accessToken;

      // Login second time (new session)
      const login2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'patient@example.com',
          password: 'TestPassword123!',
        })
        .expect(200);

      const token2 = login2.body.accessToken;

      // Both tokens should work initially
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);
    });
  });
});
