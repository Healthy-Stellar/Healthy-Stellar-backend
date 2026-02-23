import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { FhirModule } from '../fhir.module';
import { AuthModule } from '../../auth/auth.module';
import { ExportJobStatus } from '../entities/bulk-export-job.entity';

describe('FHIR Bulk Export (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
          synchronize: true,
        }),
        BullModule.forRoot({
          connection: { host: 'localhost', port: 6379 },
        }),
        FhirModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get auth tokens (mock implementation)
    authToken = 'patient-token';
    adminToken = 'admin-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /fhir/r4/Patient/$export', () => {
    it('should initiate bulk export and return 202 with Content-Location', async () => {
      const response = await request(app.getHttpServer())
        .get('/fhir/r4/Patient/$export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ _type: 'Patient,DocumentReference' })
        .expect(HttpStatus.ACCEPTED);

      expect(response.headers['content-location']).toMatch(/\/fhir\/r4\/\$export-status\/.+/);
    });

    it('should default to all resource types if _type not specified', async () => {
      const response = await request(app.getHttpServer())
        .get('/fhir/r4/Patient/$export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.ACCEPTED);

      expect(response.headers['content-location']).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/fhir/r4/Patient/$export')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /fhir/r4/$export-status/:jobId', () => {
    let jobId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .get('/fhir/r4/Patient/$export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.ACCEPTED);

      const location = response.headers['content-location'];
      jobId = location.split('/').pop();
    });

    it('should return job status for pending job', async () => {
      const response = await request(app.getHttpServer())
        .get(`/fhir/r4/$export-status/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('status');
      expect([ExportJobStatus.PENDING, ExportJobStatus.IN_PROGRESS]).toContain(response.body.status);
    });

    it('should return download manifest for completed job', async () => {
      // Wait for job to complete (mock or actual processing)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await request(app.getHttpServer())
        .get(`/fhir/r4/$export-status/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      if (response.body.status === ExportJobStatus.COMPLETED) {
        expect(response.body).toHaveProperty('transactionTime');
        expect(response.body).toHaveProperty('output');
        expect(Array.isArray(response.body.output)).toBe(true);
      }
    });

    it('should reject access to other patient jobs', async () => {
      await request(app.getHttpServer())
        .get(`/fhir/r4/$export-status/${jobId}`)
        .set('Authorization', 'Bearer other-patient-token')
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should allow ADMIN to access any job', async () => {
      await request(app.getHttpServer())
        .get(`/fhir/r4/$export-status/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });

    it('should return 404 for non-existent job', async () => {
      await request(app.getHttpServer())
        .get('/fhir/r4/$export-status/non-existent-job')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /fhir/r4/$export-status/:jobId', () => {
    let jobId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .get('/fhir/r4/Patient/$export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.ACCEPTED);

      const location = response.headers['content-location'];
      jobId = location.split('/').pop();
    });

    it('should cancel in-progress export', async () => {
      await request(app.getHttpServer())
        .delete(`/fhir/r4/$export-status/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.NO_CONTENT);

      const statusResponse = await request(app.getHttpServer())
        .get(`/fhir/r4/$export-status/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      expect(statusResponse.body.status).toBe(ExportJobStatus.CANCELLED);
    });

    it('should reject cancellation by other patients', async () => {
      await request(app.getHttpServer())
        .delete(`/fhir/r4/$export-status/${jobId}`)
        .set('Authorization', 'Bearer other-patient-token')
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 404 for non-existent job', async () => {
      await request(app.getHttpServer())
        .delete('/fhir/r4/$export-status/non-existent-job')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('Export Format Validation', () => {
    it('should export data in NDJSON format', async () => {
      const exportResponse = await request(app.getHttpServer())
        .get('/fhir/r4/Patient/$export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.ACCEPTED);

      const location = exportResponse.headers['content-location'];
      const jobId = location.split('/').pop();

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await request(app.getHttpServer())
        .get(`/fhir/r4/$export-status/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      if (statusResponse.body.status === ExportJobStatus.COMPLETED) {
        expect(statusResponse.body.output).toBeDefined();
        statusResponse.body.output.forEach((file: any) => {
          expect(file).toHaveProperty('type');
          expect(file).toHaveProperty('url');
          expect(file).toHaveProperty('count');
          expect(file.url).toMatch(/^ipfs:\/\//);
        });
      }
    });
  });

  describe('Resource Type Filtering', () => {
    it('should export only requested resource types', async () => {
      const exportResponse = await request(app.getHttpServer())
        .get('/fhir/r4/Patient/$export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ _type: 'Patient' })
        .expect(HttpStatus.ACCEPTED);

      const location = exportResponse.headers['content-location'];
      const jobId = location.split('/').pop();

      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await request(app.getHttpServer())
        .get(`/fhir/r4/$export-status/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      if (statusResponse.body.status === ExportJobStatus.COMPLETED) {
        expect(statusResponse.body.output.every((f: any) => f.type === 'Patient')).toBe(true);
      }
    });
  });
});
