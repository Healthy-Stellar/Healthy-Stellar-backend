import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './app.module';

describe('CORS', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:4200')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    app.enableCors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 86400,
    });

    await app.init();
  });

  afterAll(() => app.close());

  it('returns correct CORS headers on OPTIONS preflight from allowed origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-methods']).toMatch(/GET/);
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
    expect(res.headers['access-control-allow-methods']).toMatch(/PATCH/);
    expect(res.headers['access-control-allow-methods']).toMatch(/DELETE/);
    expect(res.headers['access-control-allow-methods']).toMatch(/OPTIONS/);
    expect(res.headers['access-control-allow-headers']).toMatch(/Authorization/i);
    expect(res.headers['access-control-allow-headers']).toMatch(/Content-Type/i);
    expect(res.headers['access-control-max-age']).toBe('86400');
  });

  it('does not return CORS allow-origin for disallowed origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/')
      .set('Origin', 'http://evil.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows localhost:4200 as a valid origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
  });
});
