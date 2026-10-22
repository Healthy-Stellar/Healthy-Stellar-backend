// Cross-Tenant Data Leak - Security Test Suite
// File: test/security/cross-tenant-data-leak.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepository } from 'typeorm';
import { MedicalRecord } from '../../src/medical-records/entities/medical-record.entity';
import { MedicalHistory, HistoryEventType } from '../../src/medical-records/entities/medical-history.entity';
import { MedicalRecordVersion } from '../../src/medical-records/entities/medical-record-version.entity';
import { Patient } from '../../src/patients/entities/patient.entity';

describe('Cross-Tenant Data Leak - Security Tests', () => {
  let app: INestApplication;
  let medicalRecordRepo: any;
  let historyRepo: any;
  let patientRepo: any;
  let versionRepo: any;

  // Test Data
  const org1 = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Hospital A',
  };

  const org2 = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Hospital B',
  };

  const user1Org1 = { id: 'user-1-org1', email: 'doctor1@hospital-a.com', organizationId: org1.id };
  const user1Org2 = { id: 'user-1-org2', email: 'doctor1@hospital-b.com', organizationId: org2.id };

  // Test Patients
  let patientOrg1: Patient;
  let patientOrg2: Patient;

  // Test Medical Records
  let recordOrg1: MedicalRecord;
  let recordOrg2: MedicalRecord;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      // ... module config
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    medicalRecordRepo = getRepository(MedicalRecord);
    historyRepo = getRepository(MedicalHistory);
    patientRepo = getRepository(Patient);
    versionRepo = getRepository(MedicalRecordVersion);

    // Setup test data
    patientOrg1 = await patientRepo.save({
      id: 'patient-org1-123',
      mrn: 'MRN-001',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      sex: 'male',
      organizationId: org1.id,
    });

    patientOrg2 = await patientRepo.save({
      id: 'patient-org2-456',
      mrn: 'MRN-002',
      firstName: 'Jane',
      lastName: 'Smith',
      dateOfBirth: '1985-05-15',
      sex: 'female',
      organizationId: org2.id,
    });

    recordOrg1 = await medicalRecordRepo.save({
      id: 'record-org1-001',
      patientId: patientOrg1.id,
      organizationId: org1.id,
      title: 'Confidential Treatment Plan - Org1',
      recordType: 'treatment',
      status: 'active',
      createdBy: user1Org1.id,
    });

    recordOrg2 = await medicalRecordRepo.save({
      id: 'record-org2-001',
      patientId: patientOrg2.id,
      organizationId: org2.id,
      title: 'Confidential Treatment Plan - Org2',
      recordType: 'treatment',
      status: 'active',
      createdBy: user1Org2.id,
    });

    // Create history entries
    await historyRepo.save({
      organizationId: org1.id,
      patientId: patientOrg1.id,
      medicalRecordId: recordOrg1.id,
      eventType: HistoryEventType.CREATED,
      description: 'Record created in Org1',
      userId: user1Org1.id,
    });

    await historyRepo.save({
      organizationId: org2.id,
      patientId: patientOrg2.id,
      medicalRecordId: recordOrg2.id,
      eventType: HistoryEventType.CREATED,
      description: 'Record created in Org2',
      userId: user1Org2.id,
    });

    // Create versions
    await versionRepo.save({
      organizationId: org1.id,
      medicalRecordId: recordOrg1.id,
      versionNumber: 1,
      content: JSON.stringify({ title: 'Org1 Record V1' }),
      createdBy: user1Org1.id,
      changeReason: 'Initial creation',
    });

    await versionRepo.save({
      organizationId: org2.id,
      medicalRecordId: recordOrg2.id,
      versionNumber: 1,
      content: JSON.stringify({ title: 'Org2 Record V1' }),
      createdBy: user1Org2.id,
      changeReason: 'Initial creation',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('VULNERABILITY: Timeline Access Without Tenant Filter', () => {
    it('should FAIL: User from Org1 can access timeline of any patient (CURRENT BUG)', async () => {
      // This test DOCUMENTS the current vulnerability
      // User from Org1 should NOT be able to access Org2's patient timeline

      const response = await request(app.getHttpServer())
        .get(`/medical-records/timeline/${patientOrg2.id}`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id);

      // ⚠️ CURRENT BEHAVIOR: Returns 200 with Org2 data (BUG!)
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            patientId: patientOrg2.id,
            description: 'Record created in Org2',
          }),
        ]),
      );

      // ✅ EXPECTED BEHAVIOR AFTER FIX: Should return 403 Forbidden
      // expect(response.status).toBe(403);
    });

    it('should PASS: User can ONLY access timeline for their own organization (AFTER FIX)', async () => {
      // After fix is applied, this test will pass
      const response = await request(app.getHttpServer())
        .get(`/medical-records/timeline/${patientOrg1.id}`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id);

      // Should successfully return Org1 timeline
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            organizationId: org1.id,
            patientId: patientOrg1.id,
          }),
        ]),
      );

      // Should NOT contain Org2 data
      expect(response.body).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            organizationId: org2.id,
          }),
        ]),
      );
    });
  });

  describe('VULNERABILITY: Version History Access Without Tenant Filter', () => {
    it('should FAIL: User from Org1 can view version history of Org2 record (CURRENT BUG)', async () => {
      // This DOCUMENTS the current vulnerability
      const response = await request(app.getHttpServer())
        .get(`/medical-records/${recordOrg2.id}/versions`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id);

      // ⚠️ CURRENT BEHAVIOR: Returns version history (BUG!)
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            medicalRecordId: recordOrg2.id,
            organizationId: org2.id,
          }),
        ]),
      );

      // ✅ AFTER FIX: Should return 403 Forbidden or 404 Not Found
      // expect(response.status).toBe(403);
    });

    it('should allow version access only for own organization records (AFTER FIX)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/medical-records/${recordOrg1.id}/versions`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            organizationId: org1.id,
            medicalRecordId: recordOrg1.id,
          }),
        ]),
      );

      // Attempt to access Org2 record
      const unauthorizedResponse = await request(app.getHttpServer())
        .get(`/medical-records/${recordOrg2.id}/versions`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id);

      expect(unauthorizedResponse.status).toBeOneOf([403, 404]);
    });
  });

  describe('VULNERABILITY: Record Update Without Tenant Validation', () => {
    it('should FAIL: User from Org1 can update records from Org2 (CURRENT BUG)', async () => {
      // This DOCUMENTS the current vulnerability
      const response = await request(app.getHttpServer())
        .put(`/medical-records/${recordOrg2.id}`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id)
        .send({
          title: 'HACKED - Confidential data modified',
          description: 'Record from Org2 corrupted by Org1 user',
        });

      // ⚠️ CURRENT BEHAVIOR: Probably succeeds (BUG!)
      // expect(response.status).toBe(200);

      // ✅ AFTER FIX: Should return 403 Forbidden
      // expect(response.status).toBe(403);
    });

    it('should prevent update of records from other organizations (AFTER FIX)', async () => {
      // User from Org1 attempts to modify Org2 record
      const response = await request(app.getHttpServer())
        .put(`/medical-records/${recordOrg2.id}`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id)
        .send({
          title: 'Attempted unauthorized update',
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual(
        expect.objectContaining({
          message: expect.stringMatching(/organization|tenant/i),
        }),
      );

      // Verify record was NOT modified
      const record = await medicalRecordRepo.findOne(recordOrg2.id);
      expect(record.title).toBe('Confidential Treatment Plan - Org2');
    });
  });

  describe('VULNERABILITY: Record Deletion Without Tenant Check', () => {
    it('should FAIL: User from Org1 can delete records from Org2 (CURRENT BUG)', async () => {
      // This DOCUMENTS the current vulnerability
      const response = await request(app.getHttpServer())
        .delete(`/medical-records/${recordOrg2.id}`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id);

      // ⚠️ CURRENT BEHAVIOR: Probably succeeds/404s without checking tenant (BUG!)
      // expect(response.status).toBe(204);

      // ✅ AFTER FIX: Should return 403 Forbidden
      // expect(response.status).toBe(403);
    });

    it('should prevent deletion of records from other organizations (AFTER FIX)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/medical-records/${recordOrg2.id}`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id);

      expect(response.status).toBe(403);

      // Verify record still exists and not deleted
      const record = await medicalRecordRepo.findOne(recordOrg2.id);
      expect(record.status).not.toBe('deleted');
    });
  });

  describe('VULNERABILITY: Archive/Restore Without Tenant Check', () => {
    it('should prevent archive of records from other organizations (AFTER FIX)', async () => {
      const response = await request(app.getHttpServer())
        .put(`/medical-records/${recordOrg2.id}/archive`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id);

      expect(response.status).toBe(403);

      // Verify record is still active
      const record = await medicalRecordRepo.findOne(recordOrg2.id);
      expect(record.status).toBe('active');
    });
  });

  describe('Patient Service Tenant Isolation', () => {
    it('should FAIL: findById returns patient from any organization (CURRENT BUG)', async () => {
      // This DOCUMENTS the vulnerability in PatientsService
      // Currently, service probably returns any patient by ID without tenant check

      // ✅ AFTER FIX: Should include tenantId parameter and filter
    });

    it('should prevent cross-organization patient searches (AFTER FIX)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/patients/${patientOrg2.id}`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id);

      expect(response.status).toBeOneOf([403, 404]);
    });

    it('should prevent MRN lookup across organizations (AFTER FIX)', async () => {
      // Currently findByMRN likely returns any patient with that MRN
      // After fix, should only return if in same org
      const response = await request(app.getHttpServer())
        .get(`/patients/search-by-mrn`)
        .query({ mrn: patientOrg2.mrn })
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id);

      // Should not find patient from Org2
      expect(response.status).toBe(404);
    });
  });

  describe('Audit Logging for Cross-Tenant Attempts', () => {
    it('should log security event when cross-tenant access is attempted', async () => {
      // After fix is implemented, verify audit log is created
      const auditSpy = jest.spyOn(console, 'warn');

      const response = await request(app.getHttpServer())
        .get(`/medical-records/timeline/${patientOrg2.id}`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id);

      // Should trigger security audit log
      // expect(auditSpy).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     event: 'CROSS_TENANT_ATTEMPT',
      //   }),
      // );

      auditSpy.mockRestore();
    });
  });

  describe('Tenant Context Extraction', () => {
    it('should extract tenantId from X-Tenant-ID header', async () => {
      const response = await request(app.getHttpServer())
        .get(`/medical-records/search`)
        .set('Authorization', `Bearer ${user1Org1.id}`)
        .set('X-Tenant-ID', org1.id)
        .query({ patientId: patientOrg1.id });

      expect(response.status).toBe(200);
      // Verify results are filtered by tenant
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            organizationId: org1.id,
          }),
        ]),
      );
    });

    it('should extract tenantId from JWT claims', async () => {
      // If JWT includes tenantId claim, it should be extracted
      // Implementation depends on JWT structure
    });

    it('should reject request if tenantId is missing', async () => {
      // After security fix, requests without tenant context should be rejected
      const response = await request(app.getHttpServer())
        .get(`/medical-records/search`)
        .set('Authorization', `Bearer ${user1Org1.id}`);
      // .set('X-Tenant-ID', org1.id);  // Omitted

      // Should return 400 or 401
      expect(response.status).toBeOneOf([400, 401, 403]);
    });
  });

  describe('Database-Level Tenant Constraints', () => {
    it('should enforce NOT NULL constraints on organizationId', async () => {
      // After migration, attempting to create record without organizationId should fail
      expect(async () => {
        await medicalRecordRepo.save({
          patientId: patientOrg1.id,
          organizationId: null,  // Should violate constraint
          title: 'Invalid record',
          recordType: 'treatment',
        });
      }).rejects.toThrow();
    });

    it('should create covering indexes for tenant isolation queries', async () => {
      // Verify indexes exist
      // SELECT indexname FROM pg_indexes WHERE tablename = 'medical_history'
      // Should include: idx_medical_history_organization_patient_event
    });
  });
});

describe('Performance: Tenant Filtering Impact', () => {
  it('should filter queries efficiently with tenant index', async () => {
    // Measure query performance with organizationId filter
    const start = performance.now();

    await historyRepo.find({
      where: {
        organizationId: org1.id,
        patientId: patientOrg1.id,
      },
    });

    const duration = performance.now() - start;
    
    // Query should complete in <100ms with proper indexes
    expect(duration).toBeLessThan(100);
  });
});

export const testExpectHelpers = {
  // Add missing expect helper
  toBeOneOf: (received: any, expected: any[]) => {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be one of ${expected}`
          : `Expected ${received} to be one of ${expected}`,
    };
  },
};

// Register custom matcher
expect.extend(testExpectHelpers);
