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

@Module({ controllers: [SecurityHeadersTestController] })
class SecurityHeadersTestModule {}

describe('Security headers integration (Issue #653)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SecurityHeadersTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    applySecurityHeaders(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('sets CSP header on all routes', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    const csp = res.headers['content-security-policy'] as string | undefined;

    // In staging NODE_ENV the header may be report-only; allow both header names
    const reportOnly = res.headers['content-security-policy-report-only'];
    expect(csp ?? reportOnly).toBeDefined();
  });

  it('CSP includes default-src self', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    const csp =
      (res.headers['content-security-policy'] as string) ||
      (res.headers['content-security-policy-report-only'] as string);

    expect(csp).toContain("default-src 'self'");
  });

  it('CSP includes object-src none', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    const csp =
      (res.headers['content-security-policy'] as string) ||
      (res.headers['content-security-policy-report-only'] as string);

    expect(csp).toContain("object-src 'none'");
  });

  it('CSP includes frame-ancestors none', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    const csp =
      (res.headers['content-security-policy'] as string) ||
      (res.headers['content-security-policy-report-only'] as string);

    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('CSP includes connect-src', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    const csp =
      (res.headers['content-security-policy'] as string) ||
      (res.headers['content-security-policy-report-only'] as string);

    expect(csp).toContain('connect-src');
  });

  it('CSP includes script-src', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    const csp =
      (res.headers['content-security-policy'] as string) ||
      (res.headers['content-security-policy-report-only'] as string);

    expect(csp).toContain('script-src');
  });

  it('CSP includes img-src', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    const csp =
      (res.headers['content-security-policy'] as string) ||
      (res.headers['content-security-policy-report-only'] as string);

    expect(csp).toContain('img-src');
  });

  it('applies X-Frame-Options: DENY', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('applies X-Content-Type-Options: nosniff', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('applies Strict-Transport-Security with 1-year max-age', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
  });

  it('applies Referrer-Policy: no-referrer', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('sets X-XSS-Protection: 0', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.headers['x-xss-protection']).toBe('0');
  });
});

describe('buildHelmetOptions CSP directives (unit)', () => {
  it('uses strict script-src in non-development', () => {
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    // Re-import to pick up env change
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildHelmetOptions } = require('./http-security.config');
    const opts = buildHelmetOptions();
    const directives = (opts as any).contentSecurityPolicy.directives;
    expect(directives.scriptSrc).not.toContain('cdn.jsdelivr.net');
    process.env.NODE_ENV = savedEnv;
  });

  it('allows Swagger CDN assets in development', () => {
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildHelmetOptions } = require('./http-security.config');
    const opts = buildHelmetOptions();
    const directives = (opts as any).contentSecurityPolicy.directives;
    expect(directives.scriptSrc).toContain('cdn.jsdelivr.net');
    process.env.NODE_ENV = savedEnv;
  });
});
