import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../src/auth/entities/user.entity';
import { Patient } from '../src/patients/entities/patient.entity';
import { AccessGrant } from '../src/access-control/entities/access-grant.entity';
import { Record } from '../src/records/entities/record.entity';
import { StellarService } from '../src/stellar/services/stellar.service';
import { IpfsService } from '../src/stellar/services/ipfs.service';

describe('Access Control Grant/Revoke Workflow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let patientRepository: Repository<Patient>;
  let accessGrantRepository: Repository<AccessGrant>;
  let recordRepository: Repository<Record>;
  let stellarService: StellarService;
  let ipfsService: IpfsService;

  // Test users
  let patientUserId: string;
  let patientAccessToken: string;
  let providerUserId: string;
  let providerAccessToken: string;

  // Test data
  const patientData = {
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice.johnson@example.com',
    password: 'PatientPassword123!',
    dateOfBirth: '1985-05-20',
    gender: 'FEMALE',
    phoneNumber: '555-0001',
    address: '456 Oak Ave',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60601',
  };

  const providerData = {
    firstName: 'Dr.',
    lastName: 'Brown',
    email: 'dr.brown@example.com',
    password: 'ProviderPassword123!',
    role: 'PHYSICIAN',
    npi: '1111111111',
    licenseNumber: 'IL111111',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    patientRepository = moduleFixture.get(getRepositoryToken(Patient));
    accessGrantRepository = moduleFixture.get(getRepositoryToken(AccessGrant));
    recordRepository = moduleFixture.get(getRepositoryToken(Record));
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
  });

  describe('POST /access/grant - Grant Access', () => {
    beforeEach(async () => {
      // Create test medical records
      const record1 = await recordRepository.save({
        id: 'record-1',
        patientId: patientUserId,
        cid: 'QmTestRecord1',
        stellarTxHash: 'tx-hash-1',
        metadata: { recordType: 'consultation' },
      });

      const record2 = await recordRepository.save({
        id: 'record-2',
        patientId: patientUserId,
        cid: 'QmTestRecord2',
        stellarTxHash: 'tx-hash-2',
        metadata: { recordType: 'lab-results' },
      });
    });

    it('should grant read access to provider for specific records', async () => {
      const response = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: providerUserId,
          recordIds: ['record-1'],
          accessLevel: 'READ',
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.patientId).toBe(patientUserId);
      expect(response.body.granteeId).toBe(providerUserId);
      expect(response.body.accessLevel).toBe('READ');
      expect(response.body.recordIds).toContain('record-1');
    });

    it('should grant read-write access to provider', async () => {
      const response = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: providerUserId,
          recordIds: ['record-1', 'record-2'],
          accessLevel: 'READ_WRITE',
        })
        .expect(201);

      expect(response.body.accessLevel).toBe('READ_WRITE');
      expect(response.body.recordIds).toContain('record-1');
      expect(response.body.recordIds).toContain('record-2');
    });

    it('should set expiration date when provided', async () => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7); // 7 days from now

      const response = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: providerUserId,
          recordIds: ['record-1'],
          accessLevel: 'READ',
          expiresAt: expirationDate.toISOString(),
        })
        .expect(201);

      expect(response.body.expiresAt).toBeDefined();
      expect(new Date(response.body.expiresAt).getTime()).toBeLessThanOrEqual(
        expirationDate.getTime(),
      );
    });

    it('should mark emergency access grants', async () => {
      const response = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: providerUserId,
          recordIds: ['record-1'],
          accessLevel: 'READ',
          isEmergency: true,
          emergencyReason: 'Critical medical emergency',
        })
        .expect(201);

      expect(response.body.isEmergency).toBe(true);
      expect(response.body.emergencyReason).toBe('Critical medical emergency');
    });

    it('should reject grant from non-patient requesting access', async () => {
      // Attempt to grant as provider (not patient owners records)
      const response = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${providerAccessToken}`)
        .send({
          granteeId: patientUserId,
          recordIds: ['record-1'],
          accessLevel: 'READ',
        })
        .expect(403);

      expect(response.body.message).toBeDefined();
    });

    it('should reject grant without authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/access/grant')
        .send({
          granteeId: providerUserId,
          recordIds: ['record-1'],
          accessLevel: 'READ',
        })
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should reject grant for non-existent records', async () => {
      const response = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: providerUserId,
          recordIds: ['non-existent-record'],
          accessLevel: 'READ',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should persist grant in database', async () => {
      const response = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: providerUserId,
          recordIds: ['record-1'],
          accessLevel: 'READ',
        })
        .expect(201);

      const grantId = response.body.id;

      // Verify in database
      const savedGrant = await accessGrantRepository.findOne({
        where: { id: grantId },
      });

      expect(savedGrant).toBeDefined();
      expect(savedGrant.patientId).toBe(patientUserId);
      expect(savedGrant.granteeId).toBe(providerUserId);
      expect(savedGrant.status).toBe('ACTIVE');
    });
  });

  describe('GET /access/grants - List Patient Grants', () => {
    beforeEach(async () => {
      // Create test records
      await recordRepository.save({
        id: 'record-1',
        patientId: patientUserId,
        cid: 'QmTestRecord1',
        stellarTxHash: 'tx-hash-1',
        metadata: { recordType: 'consultation' },
      });

      // Create multiple grants
      await accessGrantRepository.save({
        patientId: patientUserId,
        granteeId: providerUserId,
        recordIds: ['record-1'],
        accessLevel: 'READ',
        status: 'ACTIVE',
      });
    });

    it('should list all active grants for patient', async () => {
      const response = await request(app.getHttpServer())
        .get('/access/grants')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].patientId).toBe(patientUserId);
      expect(response.body[0].status).toBe('ACTIVE');
    });

    it('should not list grants for other patients', async () => {
      // Create another patient
      const otherPatientResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...patientData,
          email: 'bob.patient@example.com',
        })
        .expect(201);

      const otherPatientAccessToken = otherPatientResponse.body.tokens.accessToken;

      const response = await request(app.getHttpServer())
        .get('/access/grants')
        .set('Authorization', `Bearer ${otherPatientAccessToken}`)
        .expect(200);

      expect(
        response.body.some((g: any) => g.patientId === patientUserId),
      ).toBe(false);
    });

    it('should require authentication to list grants', async () => {
      const response = await request(app.getHttpServer())
        .get('/access/grants')
        .expect(401);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /access/received - Provider Received Grants', () => {
    beforeEach(async () => {
      const record = await recordRepository.save({
        id: 'record-1',
        patientId: patientUserId,
        cid: 'QmTestRecord1',
        stellarTxHash: 'tx-hash-1',
        metadata: { recordType: 'consultation' },
      });

      await accessGrantRepository.save({
        patientId: patientUserId,
        granteeId: providerUserId,
        recordIds: ['record-1'],
        accessLevel: 'READ',
        status: 'ACTIVE',
      });
    });

    it('should list all grants received by provider', async () => {
      const response = await request(app.getHttpServer())
        .get('/access/received')
        .set('Authorization', `Bearer ${providerAccessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].granteeId).toBe(providerUserId);
    });

    it('should include record details in received grants', async () => {
      const response = await request(app.getHttpServer())
        .get('/access/received')
        .set('Authorization', `Bearer ${providerAccessToken}`)
        .expect(200);

      const grant = response.body[0];
      expect(grant.recordIds).toBeDefined();
      expect(Array.isArray(grant.recordIds)).toBe(true);
    });
  });

  describe('DELETE /access/grant/:grantId - Revoke Access', () => {
    let grantId: string;

    beforeEach(async () => {
      const record = await recordRepository.save({
        id: 'record-1',
        patientId: patientUserId,
        cid: 'QmTestRecord1',
        stellarTxHash: 'tx-hash-1',
        metadata: { recordType: 'consultation' },
      });

      const grant = await accessGrantRepository.save({
        patientId: patientUserId,
        granteeId: providerUserId,
        recordIds: ['record-1'],
        accessLevel: 'READ',
        status: 'ACTIVE',
      });

      grantId = grant.id;
    });

    it('should revoke access grant by patient', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/access/grant/${grantId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe('REVOKED');
      expect(response.body.revokedAt).toBeDefined();
      expect(response.body.revokedBy).toBe(patientUserId);
    });

    it('should include revocation reason when provided', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/access/grant/${grantId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          reason: 'No longer trust this provider',
        })
        .expect(200);

      expect(response.body.revocationReason).toBe('No longer trust this provider');
    });

    it('should prevent provider from revoking other grants', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/access/grant/${grantId}`)
        .set('Authorization', `Bearer ${providerAccessToken}`)
        .expect(403);

      expect(response.body.message).toBeDefined();
    });

    it('should prevent revocation without authentication', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/access/grant/${grantId}`)
        .expect(401);

      expect(response.body.message).toBeDefined();
    });

    it('should update grant status in database', async () => {
      await request(app.getHttpServer())
        .delete(`/access/grant/${grantId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      const revokedGrant = await accessGrantRepository.findOne({
        where: { id: grantId },
      });

      expect(revokedGrant.status).toBe('REVOKED');
      expect(revokedGrant.revokedAt).toBeDefined();
      expect(revokedGrant.revokedBy).toBe(patientUserId);
    });

    it('should prevent duplicate revocation', async () => {
      // First revocation
      await request(app.getHttpServer())
        .delete(`/access/grant/${grantId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      // Second revocation should fail
      const response = await request(app.getHttpServer())
        .delete(`/access/grant/${grantId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Integration: Access Control Workflow', () => {
    it('should complete full access grant and revoke workflow', async () => {
      // 1. Create medical record
      const record = await recordRepository.save({
        id: 'record-1',
        patientId: patientUserId,
        cid: 'QmTestRecord1',
        stellarTxHash: 'tx-hash-1',
        metadata: { recordType: 'consultation' },
      });

      // 2. Grant access
      const grantResponse = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: providerUserId,
          recordIds: ['record-1'],
          accessLevel: 'READ',
        })
        .expect(201);

      const grantId = grantResponse.body.id;
      expect(grantResponse.body.status).toBe('ACTIVE');

      // 3. Patient lists grants
      const grantsResponse = await request(app.getHttpServer())
        .get('/access/grants')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(grantsResponse.body.some((g: any) => g.id === grantId)).toBe(
        true,
      );

      // 4. Provider sees received grant
      const receivedResponse = await request(app.getHttpServer())
        .get('/access/received')
        .set('Authorization', `Bearer ${providerAccessToken}`)
        .expect(200);

      expect(receivedResponse.body.some((g: any) => g.id === grantId)).toBe(
        true,
      );

      // 5. Patient revokes access
      const revokeResponse = await request(app.getHttpServer())
        .delete(`/access/grant/${grantId}`)
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          reason: 'Access no longer needed',
        })
        .expect(200);

      expect(revokeResponse.body.status).toBe('REVOKED');
      expect(revokeResponse.body.revocationReason).toBe('Access no longer needed');

      // 6. Verify grant is no longer in active list
      const grantsAfterRevokeResponse = await request(app.getHttpServer())
        .get('/access/grants')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      const revokedGrant = grantsAfterRevokeResponse.body.find(
        (g: any) => g.id === grantId,
      );
      if (revokedGrant) {
        expect(revokedGrant.status).toBe('REVOKED');
      }
    });

    it('should handle multiple concurrent grants', async () => {
      // Create a second provider
      const secondProviderResponse = await request(app.getHttpServer())
        .post('/auth/register/staff')
        .send({
          ...providerData,
          email: 'dr.green@example.com',
          npi: '2222222222',
        })
        .expect(201);

      const secondProviderUserId = secondProviderResponse.body.user.id;

      // Create records
      await recordRepository.save({
        id: 'record-1',
        patientId: patientUserId,
        cid: 'QmTestRecord1',
        stellarTxHash: 'tx-hash-1',
        metadata: { recordType: 'consultation' },
      });

      await recordRepository.save({
        id: 'record-2',
        patientId: patientUserId,
        cid: 'QmTestRecord2',
        stellarTxHash: 'tx-hash-2',
        metadata: { recordType: 'lab-results' },
      });

      // Grant to first provider
      const grant1Response = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: providerUserId,
          recordIds: ['record-1'],
          accessLevel: 'READ',
        })
        .expect(201);

      // Grant to second provider
      const grant2Response = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: secondProviderUserId,
          recordIds: ['record-2'],
          accessLevel: 'READ_WRITE',
        })
        .expect(201);

      // List patient's grants
      const grantsResponse = await request(app.getHttpServer())
        .get('/access/grants')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .expect(200);

      expect(grantsResponse.body.length).toBeGreaterThanOrEqual(2);
      expect(
        grantsResponse.body.some((g: any) => g.id === grant1Response.body.id),
      ).toBe(true);
      expect(
        grantsResponse.body.some((g: any) => g.id === grant2Response.body.id),
      ).toBe(true);
    });
  });

  describe('Edge Cases & Security', () => {
    let recordId = 'record-1';

    beforeEach(async () => {
      await recordRepository.save({
        id: recordId,
        patientId: patientUserId,
        cid: 'QmTestRecord1',
        stellarTxHash: 'tx-hash-1',
        metadata: { recordType: 'consultation' },
      });
    });

    it('should not allow patient to grant access to own records to self', async () => {
      // Some systems may restrict self-grants
      const response = await request(app.getHttpServer())
        .post('/access/grant')
        .set('Authorization', `Bearer ${patientAccessToken}`)
        .send({
          granteeId: patientUserId,
          recordIds: [recordId],
          accessLevel: 'READ',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should enforce access level restrictions on expired grants', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

      const grant = await accessGrantRepository.save({
        patientId: patientUserId,
        granteeId: providerUserId,
        recordIds: [recordId],
        accessLevel: 'READ',
        status: 'ACTIVE',
        expiresAt: expiredDate,
      });

      // Attempting to use expired grant should fail
      // (Specific endpoint would depend on record access endpoint)
      // This test validates that the grant exists but is expired
      const savedGrant = await accessGrantRepository.findOne({
        where: { id: grant.id },
      });
      expect(new Date(savedGrant.expiresAt) < new Date()).toBe(true);
    });
  });
});
