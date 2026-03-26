import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as request from 'supertest';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import {
  AuthRateLimit,
  ReadRateLimit,
  WriteRateLimit,
  AdminRateLimit,
} from './throttler.decorator';

@Controller('test')
class TestController {
  @Get('auth')
  @AuthRateLimit()
  authEndpoint() {
    return { message: 'auth success' };
  }

  @Get('read')
  @ReadRateLimit()
  readEndpoint() {
    return { message: 'read success' };
  }

  @Post('write')
  @WriteRateLimit()
  writeEndpoint() {
    return { message: 'write success' };
  }

  @Get('admin')
  @AdminRateLimit()
  adminEndpoint() {
    return { message: 'admin success' };
  }

  @Get('default')
  defaultEndpoint() {
    return { message: 'default success' };
  }
}

describe('Rate Limiting Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'default', ttl: 60000, limit: 100 },
            { name: 'auth', ttl: 60000, limit: 5 },
            { name: 'read', ttl: 60000, limit: 100 },
            { name: 'write', ttl: 60000, limit: 20 },
            { name: 'admin', ttl: 60000, limit: 50 },
          ],
        }),
      ],
      controllers: [TestController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: CustomThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth endpoints', () => {
    it('should allow requests within limit', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer()).get('/test/auth').expect(200);

        expect(response.headers['x-ratelimit-limit']).toBe('5');
        expect(response.headers['x-ratelimit-category']).toBe('auth');
      }
    });

    it('should return 429 when limit exceeded', async () => {
      // First 5 requests should succeed
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/test/auth').expect(200);
      }

      // 6th request should fail
      const response = await request(app.getHttpServer()).get('/test/auth').expect(429);

      expect(response.headers['retry-after']).toBeDefined();
      expect(response.body.message).toContain('auth endpoints');
    });
  });

  describe('Read endpoints', () => {
    it('should set correct rate limit headers', async () => {
      const response = await request(app.getHttpServer()).get('/test/read').expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      expect(response.headers['x-ratelimit-category']).toBe('read');
    });

    it('should decrement remaining count', async () => {
      const response1 = await request(app.getHttpServer()).get('/test/read').expect(200);

      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining']);

      const response2 = await request(app.getHttpServer()).get('/test/read').expect(200);

      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining']);

      expect(remaining2).toBeLessThan(remaining1);
    });
  });

  describe('Write endpoints', () => {
    it('should apply write rate limits', async () => {
      const response = await request(app.getHttpServer()).post('/test/write').expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('20');
      expect(response.headers['x-ratelimit-category']).toBe('write');
    });
  });

  describe('Admin endpoints', () => {
    it('should apply admin rate limits', async () => {
      const response = await request(app.getHttpServer()).get('/test/admin').expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('50');
      expect(response.headers['x-ratelimit-category']).toBe('admin');
    });
  });

  describe('Default endpoints', () => {
    it('should apply default rate limits', async () => {
      const response = await request(app.getHttpServer()).get('/test/default').expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-category']).toBe('default');
    });
  });

  describe('Rate limit headers', () => {
    it('should include reset timestamp', async () => {
      const response = await request(app.getHttpServer()).get('/test/read').expect(200);

      const resetTime = parseInt(response.headers['x-ratelimit-reset']);
      const currentTime = Math.floor(Date.now() / 1000);

      expect(resetTime).toBeGreaterThan(currentTime);
      expect(resetTime).toBeLessThan(currentTime + 120); // Within 2 minutes
    });

    it('should set Retry-After on 429 response', async () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/test/auth');
      }

      const response = await request(app.getHttpServer()).get('/test/auth').expect(429);

      const retryAfter = parseInt(response.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });

  describe('IP-based tracking', () => {
    it('should track by IP for unauthenticated requests', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/test/read')
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(200);

      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining']);

      const response2 = await request(app.getHttpServer())
        .get('/test/read')
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(200);

      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining']);

      expect(remaining2).toBeLessThan(remaining1);
    });

    it('should track different IPs separately', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/test/read')
        .set('X-Forwarded-For', '192.168.1.2')
        .expect(200);

      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining']);

      const response2 = await request(app.getHttpServer())
        .get('/test/read')
        .set('X-Forwarded-For', '192.168.1.3')
        .expect(200);

      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining']);

      // Different IPs should have independent counters
      expect(remaining2).toBeGreaterThanOrEqual(remaining1);
    });
  });
});
