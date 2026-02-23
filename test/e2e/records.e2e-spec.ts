/**
 * Records E2E Tests
 * 
 * End-to-end tests for the Records API with real database.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { cleanDatabase, seedTestData } from '../utils/test-database';
import { testData, assertPaginatedResponse } from '../utils/test-helpers';

describe('Records API (E2E)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same pipes as production
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Get auth token (mock for now)
    authToken = 'Bearer mock-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase();
  });

  describe('GET /records', () => {
    beforeEach(async () => {
      // Seed test data
      const records = Array.from({ length: 25 }, (_, i) =>
        testData.record({
          id: `record-${i + 1}`,
          patientId: 'patient-123',
          recordType: i % 2 === 0 ? 'MEDICAL_REPORT' : 'LAB_RESULT',
          createdAt: new Date(2024, 0, i + 1),
        }),
      );

      await seedTestData({ records });
    });

    it('should return paginated records with default parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/records')
        .set('Authorization', authToken)
        .expect(200);

      assertPaginatedResponse(response.body);
      expect(response.body.data.length).toBeLessThanOrEqual(20);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(20);
      expect(response.body.meta.total).toBe(25);
    });

    it('should paginate correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?page=2&limit=10')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.length).toBe(10);
      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.limit).toBe(10);
      expect(response.body.meta.hasNextPage).toBe(true);
      expect(response.body.meta.hasPreviousPage).toBe(true);
    });

    it('should filter by recordType', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?recordType=MEDICAL_REPORT')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.every((r: any) => r.recordType === 'MEDICAL_REPORT')).toBe(true);
    });

    it('should filter by patientId', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?patientId=patient-123')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.every((r: any) => r.patientId === 'patient-123')).toBe(true);
    });

    it('should filter by date range', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?fromDate=2024-01-05T00:00:00Z&toDate=2024-01-15T23:59:59Z')
        .set('Authorization', authToken)
        .expect(200);

      const dates = response.body.data.map((r: any) => new Date(r.createdAt));
      const fromDate = new Date('2024-01-05');
      const toDate = new Date('2024-01-15');

      dates.forEach((date: Date) => {
        expect(date.getTime()).toBeGreaterThanOrEqual(fromDate.getTime());
        expect(date.getTime()).toBeLessThanOrEqual(toDate.getTime());
      });
    });

    it('should sort by createdAt ascending', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?sortBy=createdAt&order=asc')
        .set('Authorization', authToken)
        .expect(200);

      const dates = response.body.data.map((r: any) => new Date(r.createdAt).getTime());
      const sortedDates = [...dates].sort((a, b) => a - b);
      expect(dates).toEqual(sortedDates);
    });

    it('should sort by createdAt descending (default)', async () => {
      const response = await request(app.getHttpServer())
        .get('/records')
        .set('Authorization', authToken)
        .expect(200);

      const dates = response.body.data.map((r: any) => new Date(r.createdAt).getTime());
      const sortedDates = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sortedDates);
    });

    it('should reject limit > 100', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?limit=101')
        .set('Authorization', authToken)
        .expect(400);

      expect(response.body.message).toContain('limit');
    });

    it('should reject invalid page number', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?page=0')
        .set('Authorization', authToken)
        .expect(400);

      expect(response.body.message).toContain('page');
    });

    it('should reject invalid recordType', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?recordType=INVALID_TYPE')
        .set('Authorization', authToken)
        .expect(400);

      expect(response.body.message).toContain('recordType');
    });

    it('should handle empty results', async () => {
      await cleanDatabase();

      const response = await request(app.getHttpServer())
        .get('/records')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
      expect(response.body.meta.totalPages).toBe(0);
    });

    it('should combine multiple filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/records?recordType=LAB_RESULT&patientId=patient-123&sortBy=createdAt&order=asc&page=1&limit=5')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.data.every((r: any) => r.recordType === 'LAB_RESULT')).toBe(true);
      expect(response.body.data.every((r: any) => r.patientId === 'patient-123')).toBe(true);
    });
  });

  describe('GET /records/:id', () => {
    it('should return a single record', async () => {
      const record = testData.record({ id: 'test-record-123' });
      await seedTestData({ records: [record] });

      const response = await request(app.getHttpServer())
        .get('/records/test-record-123')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.id).toBe('test-record-123');
      expect(response.body.patientId).toBe(record.patientId);
    });

    it('should return 404 for non-existent record', async () => {
      await request(app.getHttpServer())
        .get('/records/non-existent-id')
        .set('Authorization', authToken)
        .expect(404);
    });
  });

  describe('POST /records', () => {
    it('should create a new record', async () => {
      const mockFile = Buffer.from('encrypted file content');

      const response = await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', authToken)
        .field('patientId', 'patient-123')
        .field('recordType', 'MEDICAL_REPORT')
        .field('description', 'Test record')
        .attach('file', mockFile, 'test.pdf')
        .expect(201);

      expect(response.body).toHaveProperty('recordId');
      expect(response.body).toHaveProperty('cid');
      expect(response.body).toHaveProperty('stellarTxHash');
    });

    it('should reject upload without file', async () => {
      await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', authToken)
        .field('patientId', 'patient-123')
        .field('recordType', 'MEDICAL_REPORT')
        .expect(400);
    });

    it('should reject invalid recordType', async () => {
      const mockFile = Buffer.from('encrypted file content');

      await request(app.getHttpServer())
        .post('/records')
        .set('Authorization', authToken)
        .field('patientId', 'patient-123')
        .field('recordType', 'INVALID_TYPE')
        .attach('file', mockFile, 'test.pdf')
        .expect(400);
    });
  });
});
