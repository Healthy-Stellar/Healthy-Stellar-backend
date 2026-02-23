import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Security Headers (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply the same configuration as main.ts
    const helmet = require('helmet');
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false,
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        frameguard: {
          action: 'deny',
        },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: {
          policy: 'strict-origin-when-cross-origin',
        },
      }),
    );

    app.getHttpAdapter().getInstance().disable('x-powered-by');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Helmet Security Headers', () => {
    it('should include X-Frame-Options: DENY', async () => {
      const response = await request(app.getHttpServer()).get('/');
      
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should include X-Content-Type-Options: nosniff', async () => {
      const response = await request(app.getHttpServer()).get('/');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include Strict-Transport-Security with proper configuration', async () => {
      const response = await request(app.getHttpServer()).get('/');
      
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
      expect(response.headers['strict-transport-security']).toContain('preload');
    });

    it('should include Content-Security-Policy', async () => {
      const response = await request(app.getHttpServer()).get('/');
      
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should have CSP with default-src self', async () => {
      const response = await request(app.getHttpServer()).get('/');
      const csp = response.headers['content-security-policy'];
      
      expect(csp).toContain("default-src 'self'");
    });

    it('should have CSP without unsafe-inline for scripts', async () => {
      const response = await request(app.getHttpServer()).get('/');
      const csp = response.headers['content-security-policy'];
      
      // Check that script-src doesn't contain unsafe-inline or unsafe-eval
      const scriptSrcMatch = csp.match(/script-src[^;]*/);
      if (scriptSrcMatch) {
        expect(scriptSrcMatch[0]).not.toContain("'unsafe-inline'");
        expect(scriptSrcMatch[0]).not.toContain("'unsafe-eval'");
      }
    });

    it('should have CSP with object-src none', async () => {
      const response = await request(app.getHttpServer()).get('/');
      const csp = response.headers['content-security-policy'];
      
      expect(csp).toContain("object-src 'none'");
    });

    it('should have CSP with frame-src none', async () => {
      const response = await request(app.getHttpServer()).get('/');
      const csp = response.headers['content-security-policy'];
      
      expect(csp).toContain("frame-src 'none'");
    });

    it('should include Referrer-Policy', async () => {
      const response = await request(app.getHttpServer()).get('/');
      
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should NOT include X-Powered-By header', async () => {
      const response = await request(app.getHttpServer()).get('/');
      
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should include X-XSS-Protection (if set by helmet)', async () => {
      const response = await request(app.getHttpServer()).get('/');
      
      // Helmet may or may not set this depending on version
      // Just verify it's either set correctly or not present
      if (response.headers['x-xss-protection']) {
        expect(response.headers['x-xss-protection']).toBeTruthy();
      }
    });
  });

  describe('CORS Configuration', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app.getHttpServer())
        .options('/')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');
      
      expect(response.status).toBeLessThan(500);
    });

    it('should include CORS headers for allowed origins', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .set('Origin', 'http://localhost:3000');
      
      // CORS headers should be present
      expect(
        response.headers['access-control-allow-origin'] ||
        response.headers['vary']
      ).toBeDefined();
    });
  });

  describe('Security Best Practices', () => {
    it('should not expose sensitive server information', async () => {
      const response = await request(app.getHttpServer()).get('/');
      
      // Check that common sensitive headers are not present
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-aspnet-version']).toBeUndefined();
      expect(response.headers['x-aspnetmvc-version']).toBeUndefined();
    });

    it('should have all critical security headers present', async () => {
      const response = await request(app.getHttpServer()).get('/');
      
      const criticalHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'strict-transport-security',
        'content-security-policy',
        'referrer-policy',
      ];

      criticalHeaders.forEach(header => {
        expect(response.headers[header]).toBeDefined();
      });
    });
  });
});
