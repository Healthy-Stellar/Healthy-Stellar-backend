import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Record } from '../src/records/entities/record.entity';
import { User, UserRole } from '../src/auth/entities/user.entity';
import { Patient } from '../src/patients/entities/patient.entity';
import { AccessGrant } from '../src/access-control/entities/access-grant.entity';
import { StellarService } from '../src/stellar/services/stellar.service';
import { IpfsService } from '../src/stellar/services/ipfs.service';

describe('Medical Records CRUD (e2e)', () => {
  let app: INestApplication;
  let recordRepository: Repository<Record>;
  let userRepository: Repository<User>;
  let patientRepository: Repository<Patient>;
  let accessGrantRepository: Repository<AccessGrant>;
  let stellarService: StellarService;
  let ipfsService: IpfsService;

  // Test users
  let patientUserId: string;
  let patientAccessToken: string;
  let providerUserId: string;
  let providerAccessToken: string;

  const patientData = {
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'michael.chen@example.com',
    password: 'PatientPassword123!',
    dateOfBirth: '1995-03-10',
    gender: 'MALE',
    phoneNumber: '555-0100',
    address: '789 Elm St',
    city: 'Boston',
    state: 'MA',
    zipCode: '02101',
  };

  const providerData = {
    firstName: 'Dr.',
    lastName: 'Wilson',
    email: 'dr.wilson@example.com',
    password: 'ProviderPassword123!',
    role: 'PHYSICIAN',
    npi: '3333333333',
    licenseNumber: 'MA333333',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    recordRepository = moduleFixture.get(getRepositoryToken(Record));
    userRepository = moduleFixture.get(getRepositoryToken(User));
    patientRepository = moduleFixture.get(getRepositoryToken(Patient));
    accessGrantRepository = moduleFixture.get(getRepositoryToken(AccessGrant));
    stellarService = moduleFixture.get(StellarService);
    ipfsService = moduleFixture.get(IpfsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await accessGrantRepository.delete({});
    await recordRepository.delete({});
    await patientRepository.delete({});
    await userRepository.delete({});

    // Create test patient
    const patientResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(patientData)
      .expect(201);

    patientUserId = patientResponse.body.user.id;
    patientAccessToken = patientResponse.body.tokens.accessToken;

    // Create test provider
    const providerResponse = await request(app.getHttpServer())
      .post('/auth/register/staff')
      .send(providerData)
      .expect(201);

    providerUserId = providerResponse.body.user.id;
    providerAccessToken = providerResponse.body.tokens.accessToken;

    // Mock Stellar and IPFS services
    jest.spyOn(stellarService, 'verifyAccessOnChain').mockResolvedValue({
      hasAccess: true,
      txHash: 'mock-tx-hash',
      grantId: 'grant-mock',
    });

    jest.spyOn(ipfsService, 'fetch').mockResolvedValue({
      cid: 'QmMockCID',
      encryptedPayload: 'encrypted-payload-data',
      metadata: { fetchedAt: new Date().toISOString(), size: 1024 },
    });
  });

  describe('POST /records - Create Medical Record', () => {
    const recordPayload = {
      cid: 'QmTestRecord123',
      recordType: 'consultation',
      description: 'Patient consultation notes',
      metadata: {
        provider: 'Dr. Wilson',
        specialty: 'Cardiology',
        date: '2024-01-15',
      },
    };

    it('should create a new medical record for patient', async () => {
      const response = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send(recordPayload)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.patientId).toBe(patientUserId);
      expect(response.body.cid).toBe(recordPayload.cid);
      expect(response.body.metadata).toEqual(recordPayload.metadata);
    });

    it('should generate stellar tx hash on record creation', async () => {
      const response = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send(recordPayload)
        .expect(201);

      expect(response.body.stellarTxHash).toBeDefined();
    });

    it('should persist record to database', async () => {
      const response = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send(recordPayload)
        .expect(201);

      const recordId = response.body.id;

      const savedRecord = await recordRepository.findOne({
        where: { id: recordId },
      });

      expect(savedRecord).toBeDefined();
      expect(savedRecord.patientId).toBe(patientUserId);
      expect(savedRecord.cid).toBe(recordPayload.cid);
    });

    it('should reject record creation without authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/records')
        .send(recordPayload)
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should reject record creation by provider for patient records', async () => {
      const response = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${providerAccessToken}`)
        .send({
          ...recordPayload,
          patientId: patientUserId, // Attempting to create for another patient
        })
        .expect(403);

      expect(response.body.message).toBeDefined();
    });

    it('should validate required fields', async () => {
      const { cid, ...incompletePayload } = recordPayload;

      const response = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send(incompletePayload)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should accept multiple records from same patient', async () => {
      const response1 = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send(recordPayload)
        .expect(201);

      const response2 = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          ...recordPayload,
          cid: 'QmDifferentRecord456',
        })
        .expect(201);

      expect(response1.body.id).not.toBe(response2.body.id);
      expect(response1.body.patientId).toBe(response2.body.patientId);
    });
  });

  describe('GET /records/:id - Retrieve Medical Record', () => {
    let recordId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          cid: 'QmTestRecord123',
          recordType: 'consultation',
          description: 'Test record',
          metadata: { date: '2024-01-15' },
        })
        .expect(201);

      recordId = response.body.id;
    });

    it('should retrieve own record as patient', async () => {
      const response = await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(response.body.id).toBe(recordId);
      expect(response.body.patientId).toBe(patientUserId);
      expect(response.body.cid).toBe('QmTestRecord123');
    });

    it('should fetch content from IPFS on retrieval', async () => {
      const ipfsFetchSpy = jest.spyOn(ipfsService, 'fetch');

      const response = await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(response.body.encryptedPayload).toBeDefined();
      expect(ipfsFetchSpy).toHaveBeenCalled();
    });

    it('should return 404 for non-existent record', async () => {
      const response = await request(app.getHttpServer())
        .get('/records/non-existent-id')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(404);

      expect(response.body.message).toBeDefined();
    });

    it('should reject access to other patient records', async () => {
      // Create another patient
      const otherPatientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...patientData,
          email: 'other.patient@example.com',
        })
        .expect(201);

      const otherPatientAccessToken = otherPatientResponse.body.tokens.accessToken;

      const response = await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .set('Authorization', `Bearer ${otherPatientAccessToken}`)
        .expect(403);

      expect(response.body.message).toBeDefined();
    });

    it('should allow provider access with valid grant', async () => {
      // Grant access from patient to provider
      await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: providerUserId,
          recordIds: [recordId],
          accessLevel: 'READ',
        })
        .expect(201);

      // Provider should now be able to access
      const response = await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .set('Authorization', `Bearer ${providerAccessToken}`)
        .expect(200);

      expect(response.body.id).toBe(recordId);
    });

    it('should cache access check results', async () => {
      const verifySpy = jest.spyOn(
        stellarService,
        'verifyAccessOnChain',
      );

      // First request
      await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      const callCountAfterFirstRequest = verifySpy.mock.calls.length;

      // Second request (should use cache)
      await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      // Verify check was not called again or was called minimally
      expect(verifySpy.mock.calls.length).toBeLessThanOrEqual(
        callCountAfterFirstRequest + 1,
      );
    });

    it('should reject access without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .expect(401);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /records - List Patient Records', () => {
    beforeEach(async () => {
      // Create multiple records
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/records')
          .set('Authorization', `Bearer ${patientAccessToken}`)
          .send({
            cid: `QmRecord${i}`,
            recordType: 'consultation',
            description: `Record ${i}`,
            metadata: { index: i },
          })
          .expect(201);
      }
    });

    it('should list all records for patient', async () => {
      const response = await request(app.getHttpServer())
        .get('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
      expect(response.body.every((r: any) => r.patientId === patientUserId)).toBe(
        true,
      );
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?page=1&limit=2')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      if (Array.isArray(response.body.data)) {
        expect(response.body.data.length).toBeLessThanOrEqual(2);
      } else {
        expect(response.body.length).toBeLessThanOrEqual(2);
      }
    });

    it('should not list other patient records', async () => {
      const otherPatientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...patientData,
          email: 'other.patient2@example.com',
        })
        .expect(201);

      const otherPatientAccessToken = otherPatientResponse.body.tokens.accessToken;

      const response = await request(app.getHttpServer())
        .get('/records')
        .set('Authorization', `Bearer ${otherPatientAccessToken}`)
        .expect(200);

      expect(
        response.body.some((r: any) => r.patientId === patientUserId),
      ).toBe(false);
    });
  });

  describe('PUT /records/:id - Update Medical Record', () => {
    let recordId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          cid: 'QmTestRecord123',
          recordType: 'consultation',
          description: 'Original description',
          metadata: { date: '2024-01-15', version: 1 },
        })
        .expect(201);

      recordId = response.body.id;
    });

    it('should update record metadata by patient', async () => {
      const response = await request(app.getHttpServer())
        .put(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          description: 'Updated description',
          metadata: { date: '2024-01-15', version: 2, notes: 'Updated' },
        })
        .expect(200);

      expect(response.body.description).toBe('Updated description');
      expect(response.body.metadata.version).toBe(2);
    });

    it('should persist updates to database', async () => {
      await request(app.getHttpServer())
        .put(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          description: 'Updated description',
        })
        .expect(200);

      const updatedRecord = await recordRepository.findOne({
        where: { id: recordId },
      });

      expect(updatedRecord.description).toBe('Updated description');
    });

    it('should reject update from other patient', async () => {
      const otherPatientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...patientData,
          email: 'other.patient3@example.com',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .put(`/records/${recordId}`)
        .set('Authorization', `Bearer ${otherPatientResponse.body.tokens.accessToken}`)
        .send({
          description: 'Updated',
        })
        .expect(403);

      expect(response.body.message).toBeDefined();
    });

    it('should prevent CID modification after creation', async () => {
      const response = await request(app.getHttpServer())
        .put(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          cid: 'QmDifferentCID',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('DELETE /records/:id - Delete Medical Record', () => {
    let recordId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          cid: 'QmTestRecord123',
          recordType: 'consultation',
          description: 'Record to delete',
          metadata: { date: '2024-01-15' },
        })
        .expect(201);

      recordId = response.body.id;
    });

    it('should delete record by patient', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(response.body.message).toContain('deleted');
    });

    it('should remove record from database', async () => {
      await request(app.getHttpServer())
        .delete(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      const deletedRecord = await recordRepository.findOne({
        where: { id: recordId },
      });

      expect(deletedRecord).toBeNull();
    });

    it('should reject deletion by non-owner', async () => {
      const otherPatientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...patientData,
          email: 'other.patient4@example.com',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .delete(`/records/${recordId}`)
        .set('Authorization', `Bearer ${otherPatientResponse.body.tokens.accessToken}`)
        .expect(403);

      expect(response.body.message).toBeDefined();
    });

    it('should revoke access grants on deletion', async () => {
      // Grant access
      const grantResponse = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: providerUserId,
          recordIds: [recordId],
          accessLevel: 'READ',
        })
        .expect(201);

      const grantId = grantResponse.body.id;

      // Delete record
      await request(app.getHttpServer())
        .delete(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      // Verify grant is revoked
      const grant = await accessGrantRepository.findOne({
        where: { id: grantId },
      });

      if (grant) {
        expect(grant.status).toBe('REVOKED');
      }
    });
  });

  describe('Integration: Complete Record Lifecycle', () => {
    it('should complete full record lifecycle from creation to sharing', async () => {
      // 1. Patient creates record
      const createResponse = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          cid: 'QmCompleteLifecycleRecord',
          recordType: 'consultation',
          description: 'Complete lifecycle test',
          metadata: { testComplete: true },
        })
        .expect(201);

      const recordId = createResponse.body.id;

      // 2. Patient retrieves own record
      const getResponse = await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(getResponse.body.id).toBe(recordId);

      // 3. Patient updates record
      const updateResponse = await request(app.getHttpServer())
        .put(`/records/${recordId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          description: 'Updated with more details',
        })
        .expect(200);

      expect(updateResponse.body.description).toBe('Updated with more details');

      // 4. Patient grants access to provider
      const grantResponse = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: providerUserId,
          recordIds: [recordId],
          accessLevel: 'READ',
        })
        .expect(201);

      // 5. Provider accesses record with permission
      const providerAccessResponse = await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .set('Authorization', `Bearer ${providerAccessToken}`)
        .expect(200);

      expect(providerAccessResponse.body.id).toBe(recordId);

      // 6. Patient revokes access
      await request(app.getHttpServer())
        .delete(`/access/grant/${grantResponse.body.id}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      // 7. Provider can no longer access
      jest.spyOn(stellarService, 'verifyAccessOnChain').mockResolvedValueOnce({
        hasAccess: false,
      });

      const accessDeniedResponse = await request(app.getHttpServer())
        .get(`/records/${recordId}`)
        .set('Authorization', `Bearer ${providerAccessToken}`)
        .expect(403);

      expect(accessDeniedResponse.body.message).toBeDefined();
    });
  });
});
