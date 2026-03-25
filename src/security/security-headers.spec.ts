import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { applySecurityHeaders } from './http-security.config';

@Controller()
class SecurityHeadersTestController {
  @Get()
  getRoot() {
    return { ok: true };
  }
}

@Module({
  controllers: [SecurityHeadersTestController],
})
class SecurityHeadersTestModule {}

describe('Security headers integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SecurityHeadersTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    applySecurityHeaders(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('applies the required Helmet headers', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).toContain("object-src 'none'");
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-xss-protection']).toBe('0');
  });
});
