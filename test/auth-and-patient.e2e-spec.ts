import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../src/auth/entities/user.entity';
import { Patient } from '../src/patients/entities/patient.entity';

describe('Auth & Patient Registration (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let patientRepository: Repository<Patient>;

  const testPatientData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    password: 'SecurePassword123!',
    dateOfBirth: '1990-01-15',
    gender: 'MALE',
    phoneNumber: '555-0123',
    address: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
  };

  const testStaffData = {
    firstName: 'Dr.',
    lastName: 'Smith',
    email: 'dr.smith@example.com',
    password: 'DoctorPassword123!',
    role: 'PHYSICIAN',
    npi: '1234567890',
    licenseNumber: 'MD123456',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    patientRepository = moduleFixture.get(getRepositoryToken(Patient));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await patientRepository.delete({});
    await userRepository.delete({});
  });

  describe('POST /auth/register - Patient Registration', () => {
    it('should register a new patient successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user.email).toBe(testPatientData.email);
      expect(response.body.user.role).toBe('PATIENT');
      expect(response.body.user.id).toBeDefined();
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();

      // Verify user was persisted
      const savedUser = await userRepository.findOne({
        where: { email: testPatientData.email },
      });
      expect(savedUser).toBeDefined();
      expect(savedUser.role).toBe(UserRole.PATIENT);
    });

    it('should create associated patient entity on user registration', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData)
        .expect(201);

      const userId = response.body.user.id;

      // Verify patient entity was created
      const savedPatient = await patientRepository.findOne({
        where: { userId },
      });
      expect(savedPatient).toBeDefined();
      expect(savedPatient.firstName).toBe(testPatientData.firstName);
      expect(savedPatient.lastName).toBe(testPatientData.lastName);
      expect(savedPatient.email).toBe(testPatientData.email);
      expect(savedPatient.mrn).toBeDefined(); // MRN should be auto-generated
    });

    it('should reject registration with duplicate email', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData)
        .expect(201);

      // Second registration with same email
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData)
        .expect(400);

      expect(response.body.message).toContain('email');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...testPatientData,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.message).toContain('email');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...testPatientData,
          password: '123',
        })
        .expect(400);

      expect(response.body.message).toContain('password');
    });

    it('should reject registration with missing required fields', async () => {
      const { phoneNumber, ...incompleteData } = testPatientData;

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(incompleteData)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('POST /auth/register/staff - Healthcare Provider Registration', () => {
    it('should register a healthcare staff member', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register/staff')
        .send(testStaffData)
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.role).toBe('PHYSICIAN');
      expect(response.body.user.npi).toBe(testStaffData.npi);
      expect(response.body.user.licenseNumber).toBe(testStaffData.licenseNumber);
      expect(response.body.tokens.accessToken).toBeDefined();
    });

    it('should register nurse with NURSE role', async () => {
      const nurseData = {
        ...testStaffData,
        email: 'nurse@example.com',
        role: 'NURSE',
        npi: '9876543210',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register/staff')
        .send(nurseData)
        .expect(201);

      expect(response.body.user.role).toBe('NURSE');
    });

    it('should reject staff registration with non-staff role', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register/staff')
        .send({
          ...testStaffData,
          role: 'PATIENT',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('POST /auth/login - Authentication', () => {
    beforeEach(async () => {
      // Register a user before each login test
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testPatientData.email,
          password: testPatientData.password,
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.id).toBeDefined();
      expect(response.body.user.email).toBe(testPatientData.email);
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testPatientData.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPatientData.password,
        })
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should update lastLoginAt on successful login', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testPatientData.email,
          password: testPatientData.password,
        })
        .expect(200);

      const user = await userRepository.findOne({
        where: { email: testPatientData.email },
      });

      expect(user.lastLoginAt).not.toBeNull();
    });
  });

  describe('POST /auth/refresh - Token Refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get refresh token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData)
        .expect(201);

      refreshToken = loginResponse.body.tokens.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.accessToken).not.toBe(refreshToken);
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /auth/me - Current User Profile', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData)
        .expect(201);

      accessToken = response.body.tokens.accessToken;
    });

    it('should return current user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBeDefined();
      expect(response.body.email).toBe(testPatientData.email);
      expect(response.body.role).toBe('PATIENT');
      expect(response.body.firstName).toBe(testPatientData.firstName);
    });

    it('should reject request without authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('POST /auth/change-password - Password Management', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData)
        .expect(201);

      accessToken = response.body.tokens.accessToken;
    });

    it('should change password with valid old password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          oldPassword: testPatientData.password,
          newPassword: 'NewPassword123!',
        })
        .expect(200);

      expect(response.body.message).toContain('successfully');
    });

    it('should reject password change with wrong old password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          oldPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!',
        })
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should allow login with new password after change', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          oldPassword: testPatientData.password,
          newPassword: 'NewPassword123!',
        })
        .expect(200);

      // Login with new password should succeed
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testPatientData.email,
          password: 'NewPassword123!',
        })
        .expect(200);

      // Login with old password should fail
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testPatientData.email,
          password: testPatientData.password,
        })
        .expect(401);
    });
  });

  describe('POST /auth/logout - Session Management', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData)
        .expect(201);

      accessToken = response.body.tokens.accessToken;
      userId = response.body.user.id;
    });

    it('should logout successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toContain('successfully');
    });

    it('should invalidate token after logout', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Using same token should fail
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /patients/:id - Patient Retrieval', () => {
    let patientUserId: string;
    let patientAccessToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData)
        .expect(201);

      patientUserId = response.body.user.id;
      patientAccessToken = response.body.tokens.accessToken;
    });

    it('should retrieve patient own profile', async () => {
      const response = await request(app.getHttpServer())
        .get(`/patients/${patientUserId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(response.body.id).toBeDefined();
      expect(response.body.firstName).toBe(testPatientData.firstName);
      expect(response.body.lastName).toBe(testPatientData.lastName);
      expect(response.body.email).toBe(testPatientData.email);
      expect(response.body.mrn).toBeDefined();
    });

    it('should return 403 when accessing other patient records without authorization', async () => {
      // Create a second patient
      const secondPatientData = {
        ...testPatientData,
        email: 'jane.doe@example.com',
      };

      const secondResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(secondPatientData)
        .expect(201);

      const secondPatientId = secondResponse.body.user.id;

      // First patient attempts to access second patient
      const response = await request(app.getHttpServer())
        .get(`/patients/${secondPatientId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(403);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /patients/admin/all - Admin Patient Listing', () => {
    let adminAccessToken: string;

    beforeEach(async () => {
      // Create admin user (would need to seed this or use a different approach)
      // For now, register as patient and assume we'll update role directly
      const adminUserResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData)
        .expect(201);

      adminAccessToken = adminUserResponse.body.tokens.accessToken;

      // Update user role to ADMIN in database (since registration creates PATIENT)
      const user = await userRepository.findOne({
        where: { email: testPatientData.email },
      });
      user.role = UserRole.ADMIN;
      await userRepository.save(user);
    });

    it('should list all patients for admin user', async () => {
      // Create test patient
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...testPatientData,
          email: 'patient2@example.com',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/patients/admin/all')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 403 for non-admin user accessing admin endpoint', async () => {
      // Register as regular patient
      const patientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...testPatientData,
          email: 'patient@example.com',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/patients/admin/all')
        .set('Authorization', `Bearer ${patientResponse.body.tokens.accessToken}`)
        .expect(403);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Integration: Full Patient Workflow', () => {
    it('should complete full patient registration and login workflow', async () => {
      // 1. Register patient
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testPatientData)
        .expect(201);

      const userId = registerResponse.body.user.id;
      const accessToken = registerResponse.body.tokens.accessToken;

      expect(registerResponse.body.user.email).toBe(testPatientData.email);

      // 2. Get current user profile
      const meResponse = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meResponse.body.id).toBe(userId);

      // 3. Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // 4. Login with credentials
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testPatientData.email,
          password: testPatientData.password,
        })
        .expect(200);

      expect(loginResponse.body.accessToken).toBeDefined();

      // 5. Get patient profile
      const patientResponse = await request(app.getHttpServer())
        .get(`/patients/${userId}`)
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .expect(200);

      expect(patientResponse.body.firstName).toBe(testPatientData.firstName);
      expect(patientResponse.body.mrn).toBeDefined();
    });

    it('should complete provider registration workflow', async () => {
      // 1. Register as provider
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register/staff')
        .send(testStaffData)
        .expect(201);

      const providerId = registerResponse.body.user.id;
      const accessToken = registerResponse.body.tokens.accessToken;

      expect(registerResponse.body.user.role).toBe('PHYSICIAN');
      expect(registerResponse.body.user.npi).toBe(testStaffData.npi);

      // 2. Get provider profile
      const meResponse = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meResponse.body.id).toBe(providerId);
      expect(meResponse.body.role).toBe('PHYSICIAN');
      expect(meResponse.body.npi).toBe(testStaffData.npi);
    });
  });
});
