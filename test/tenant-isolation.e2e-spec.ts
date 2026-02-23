import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TenantService } from '../src/tenant/services/tenant.service';

describe('Tenant Isolation Tests (e2e)', () => {
  let app: INestApplication;
  let tenantService: TenantService;
  let tenant1Id: string;
  let tenant2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    tenantService = moduleFixture.get<TenantService>(TenantService);

    // Create two test tenants
    const tenant1 = await tenantService.create({
      name: 'Hospital A',
      slug: 'hospital-a',
    });
    tenant1Id = tenant1.id;

    const tenant2 = await tenantService.create({
      name: 'Hospital B',
      slug: 'hospital-b',
    });
    tenant2Id = tenant2.id;
  });

  afterAll(async () => {
    // Cleanup
    await tenantService.delete(tenant1Id);
    await tenantService.delete(tenant2Id);
    await app.close();
  });

  describe('Cross-Tenant Data Leakage Prevention', () => {
    it('should prevent access to tenant B data when authenticated as tenant A', async () => {
      // Create data in tenant A
      const responseA = await request(app.getHttpServer())
        .post('/medical-records')
        .set('X-Tenant-ID', 'hospital-a')
        .send({
          patientId: 'patient-a-001',
          recordType: 'CONSULTATION',
        })
        .expect(201);

      const recordId = responseA.body.id;

      // Try to access tenant A data with tenant B credentials
      await request(app.getHttpServer())
        .get(`/medical-records/${recordId}`)
        .set('X-Tenant-ID', 'hospital-b')
        .expect(404); // Should not find the record
    });

    it('should isolate billing data between tenants', async () => {
      // Create billing in tenant A
      await request(app.getHttpServer())
        .post('/billing')
        .set('X-Tenant-ID', 'hospital-a')
        .send({
          patientId: 'patient-a-001',
          patientName: 'John Doe',
          serviceDate: '2024-01-15',
          providerId: 'provider-001',
          providerName: 'Dr. Smith',
          lineItems: [],
        })
        .expect(201);

      // List billings from tenant B - should be empty
      const response = await request(app.getHttpServer())
        .get('/billing/patient/patient-a-001')
        .set('X-Tenant-ID', 'hospital-b')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });

    it('should prevent schema switching attacks', async () => {
      // Attempt SQL injection to switch schema
      await request(app.getHttpServer())
        .get('/medical-records')
        .set('X-Tenant-ID', "hospital-a'; SET search_path TO tenant_hospital_b; --")
        .expect(400); // Should reject invalid tenant ID
    });

    it('should enforce tenant context in nested operations', async () => {
      // Create prescription in tenant A
      const prescription = await request(app.getHttpServer())
        .post('/pharmacy/prescriptions')
        .set('X-Tenant-ID', 'hospital-a')
        .send({
          patientId: 'patient-a-001',
          providerId: 'provider-001',
          drugId: 'drug-001',
          dosage: '10mg',
          quantity: 30,
          refills: 3,
          instructions: 'Take daily',
        })
        .expect(201);

      // Try to fill prescription from tenant B
      await request(app.getHttpServer())
        .post(`/pharmacy/prescriptions/${prescription.body.id}/fill`)
        .set('X-Tenant-ID', 'hospital-b')
        .send({ pharmacistId: 'pharmacist-b-001' })
        .expect(404);
    });
  });

  describe('Tenant Context Propagation', () => {
    it('should maintain tenant context across async operations', async () => {
      const response = await request(app.getHttpServer())
        .post('/laboratory/orders')
        .set('X-Tenant-ID', 'hospital-a')
        .send({
          patientId: 'patient-a-001',
          providerId: 'provider-001',
          tests: [{ testId: 'test-001', testCode: 'CBC' }],
        })
        .expect(201);

      // Verify order is in correct tenant schema
      const order = await request(app.getHttpServer())
        .get(`/laboratory/orders/${response.body.id}`)
        .set('X-Tenant-ID', 'hospital-a')
        .expect(200);

      expect(order.body.id).toBe(response.body.id);
    });
  });

  describe('Tenant Header Validation', () => {
    it('should reject requests without tenant identifier', async () => {
      await request(app.getHttpServer())
        .get('/medical-records')
        .expect(400);
    });

    it('should reject requests with invalid tenant', async () => {
      await request(app.getHttpServer())
        .get('/medical-records')
        .set('X-Tenant-ID', 'nonexistent-tenant')
        .expect(400);
    });

    it('should reject requests with suspended tenant', async () => {
      await tenantService.update(tenant1Id, { status: 'suspended' });

      await request(app.getHttpServer())
        .get('/medical-records')
        .set('X-Tenant-ID', 'hospital-a')
        .expect(400);

      // Restore status
      await tenantService.update(tenant1Id, { status: 'active' });
    });
  });
});
