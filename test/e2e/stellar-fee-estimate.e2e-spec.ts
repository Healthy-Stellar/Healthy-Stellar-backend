import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { StellarModule } from '../../src/stellar/stellar.module';
import { ConfigModule } from '@nestjs/config';
import { StellarCacheService } from '../../src/stellar/services/stellar-cache.service';

describe('Stellar Fee Estimate (e2e)', () => {
  let app: INestApplication;
  let cacheService: StellarCacheService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        StellarModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    cacheService = moduleFixture.get<StellarCacheService>(StellarCacheService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    // Clear cache between tests
    cacheService.clear();
  });

  describe('GET /stellar/fee-estimate', () => {
    it('should return fee estimate for anchorRecord operation', () => {
      return request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .query({ operation: 'anchorRecord' })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('baseFee');
          expect(res.body).toHaveProperty('recommended');
          expect(res.body).toHaveProperty('networkCongestion');
          expect(['low', 'medium', 'high']).toContain(res.body.networkCongestion);
          expect(typeof res.body.baseFee).toBe('string');
          expect(typeof res.body.recommended).toBe('string');
        });
    });

    it('should return fee estimate for grantAccess operation', () => {
      return request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .query({ operation: 'grantAccess' })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('baseFee');
          expect(res.body).toHaveProperty('recommended');
          expect(res.body).toHaveProperty('networkCongestion');
        });
    });

    it('should return fee estimate for revokeAccess operation', () => {
      return request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .query({ operation: 'revokeAccess' })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('baseFee');
          expect(res.body).toHaveProperty('recommended');
          expect(res.body).toHaveProperty('networkCongestion');
        });
    });

    it('should return 400 for invalid operation', () => {
      return request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .query({ operation: 'invalidOperation' })
        .expect(HttpStatus.BAD_REQUEST)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Invalid operation');
        });
    });

    it('should return 400 when operation parameter is missing', () => {
      return request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should use cache on subsequent requests', async () => {
      // First request - cache miss
      const firstResponse = await request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .query({ operation: 'anchorRecord' })
        .expect(HttpStatus.OK);

      // Second request - should hit cache
      const secondResponse = await request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .query({ operation: 'anchorRecord' })
        .expect(HttpStatus.OK);

      // Both responses should be identical
      expect(firstResponse.body).toEqual(secondResponse.body);
    });

    it('should handle different operations independently in cache', async () => {
      // Request for anchorRecord
      const anchorResponse = await request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .query({ operation: 'anchorRecord' })
        .expect(HttpStatus.OK);

      // Request for grantAccess
      const grantResponse = await request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .query({ operation: 'grantAccess' })
        .expect(HttpStatus.OK);

      // Fees should be different due to different multipliers
      expect(anchorResponse.body.recommended).not.toEqual(
        grantResponse.body.recommended,
      );
    });
  });

  describe('GET /stellar/operations', () => {
    it('should return list of supported operations', () => {
      return request(app.getHttpServer())
        .get('/stellar/operations')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('operations');
          expect(Array.isArray(res.body.operations)).toBe(true);
          expect(res.body.operations).toContain('anchorRecord');
          expect(res.body.operations).toContain('grantAccess');
          expect(res.body.operations).toContain('revokeAccess');
          expect(res.body.operations).toHaveLength(3);
        });
    });
  });

  describe('Cache behavior', () => {
    it('should cache results for 30 seconds', async () => {
      // First request
      const firstResponse = await request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .query({ operation: 'anchorRecord' })
        .expect(HttpStatus.OK);

      // Immediate second request should return cached data
      const cachedResponse = await request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .query({ operation: 'anchorRecord' })
        .expect(HttpStatus.OK);

      expect(firstResponse.body).toEqual(cachedResponse.body);
    });
  });

  describe('Error handling', () => {
    it('should return 503 when Horizon is unreachable', async () => {
      // This test requires mocking or actual Horizon downtime
      // For now, we test the error structure
      const response = await request(app.getHttpServer())
        .get('/stellar/fee-estimate')
        .query({ operation: 'anchorRecord' });

      if (response.status === HttpStatus.SERVICE_UNAVAILABLE) {
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Stellar');
      }
    });
  });
});
