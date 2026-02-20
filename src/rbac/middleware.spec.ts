import { Test, TestingModule } from '@nestjs/testing';
import { HipaaHeadersMiddleware } from '../hipaa-headers.middleware';
import { RequestSanitizationMiddleware } from '../request-sanitization.middleware';
import { HealthcareSecurityMiddleware } from '../healthcare-security.middleware';
import { AuditService } from '../../audit/audit.service';
import { RateLimitingService } from '../../rate-limiting/rate-limiting.service';
import { AuditAction, AuditSeverity } from '../../entities/audit-log.entity';

const mockReq = (overrides: Record<string, unknown> = {}) => ({
  headers: { 'user-agent': 'TestAgent/1.0' },
  method: 'GET',
  path: '/test',
  query: {},
  body: {},
  ip: '1.2.3.4',
  socket: { remoteAddress: '1.2.3.4' },
  user: { id: 'user-1', role: 'physician' },
  correlationId: 'corr-123',
  ...overrides,
});

const mockRes = () => {
  const res: Record<string, unknown> = {
    headers: {} as Record<string, string>,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockImplementation(function(this: Record<string, unknown>, k: string, v: string) {
      (this.headers as Record<string, string>)[k] = v;
    }),
    removeHeader: jest.fn(),
    on: jest.fn(),
  };
  return res;
};

// ==========================================
// HIPAA HEADERS MIDDLEWARE
// ==========================================
describe('HipaaHeadersMiddleware', () => {
  let middleware: HipaaHeadersMiddleware;

  beforeEach(() => {
    middleware = new HipaaHeadersMiddleware();
  });

  it('should set no-store cache control', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      expect.stringContaining('no-store'),
    );
  });

  it('should set Content-Security-Policy', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("default-src 'self'"),
    );
  });

  it('should set X-Frame-Options to DENY', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });

  it('should set HSTS header', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.stringContaining('max-age=31536000'),
    );
  });

  it('should set X-Content-Type-Options to nosniff', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('should remove X-Powered-By header', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
  });

  it('should generate correlation ID if not present', () => {
    const req = mockReq({ headers: {} });
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', expect.any(String));
    expect((req as any).correlationId).toBeDefined();
  });

  it('should use existing correlation ID from request headers', () => {
    const req = mockReq({ headers: { 'x-correlation-id': 'existing-id' } });
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'existing-id');
  });

  it('should set HIPAA compliance identifier header', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Healthcare-Security', 'HIPAA-Compliant');
  });

  it('should set Referrer-Policy to no-referrer', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
  });

  it('should call next()', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    middleware.use(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ==========================================
// REQUEST SANITIZATION MIDDLEWARE
// ==========================================
describe('RequestSanitizationMiddleware', () => {
  let middleware: RequestSanitizationMiddleware;

  beforeEach(() => {
    middleware = new RequestSanitizationMiddleware();
  });

  it('should remove HTML tags from query params', () => {
    const req = mockReq({ query: { name: '<script>alert(1)</script>' } });
    const next = jest.fn();

    middleware.use(req as any, {} as any, next);

    expect((req as any).query.name).not.toContain('<script>');
  });

  it('should remove javascript: protocol from body', () => {
    const req = mockReq({ body: { url: 'javascript:alert(1)' } });
    const next = jest.fn();

    middleware.use(req as any, {} as any, next);

    expect((req as any).body.url).not.toContain('javascript:');
  });

  it('should handle nested objects in body', () => {
    const req = mockReq({
      body: {
        patient: {
          name: '<b>John</b>',
          notes: 'onclick=alert(1)',
        },
      },
    });
    const next = jest.fn();

    middleware.use(req as any, {} as any, next);

    expect((req as any).body.patient.name).not.toContain('<b>');
    expect((req as any).body.patient.notes).not.toContain('onclick=');
  });

  it('should handle arrays in body', () => {
    const req = mockReq({ body: { tags: ['<script>xss</script>', 'normal-tag'] } });
    const next = jest.fn();

    middleware.use(req as any, {} as any, next);

    expect((req as any).body.tags[0]).not.toContain('<script>');
    expect((req as any).body.tags[1]).toBe('normal-tag');
  });

  it('should preserve non-string values', () => {
    const req = mockReq({ body: { count: 42, active: true, data: null } });
    const next = jest.fn();

    middleware.use(req as any, {} as any, next);

    expect((req as any).body.count).toBe(42);
    expect((req as any).body.active).toBe(true);
    expect((req as any).body.data).toBeNull();
  });

  it('should call next()', () => {
    const req = mockReq();
    const next = jest.fn();

    middleware.use(req as any, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ==========================================
// HEALTHCARE SECURITY MIDDLEWARE
// ==========================================
describe('HealthcareSecurityMiddleware', () => {
  let middleware: HealthcareSecurityMiddleware;
  let auditService: jest.Mocked<AuditService>;
  let rateLimitingService: jest.Mocked<RateLimitingService>;

  const allowedRateLimit = {
    allowed: true,
    remaining: 99,
    resetAt: new Date(),
    blocked: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthcareSecurityMiddleware,
        {
          provide: AuditService,
          useValue: { log: jest.fn(), logSecurityViolation: jest.fn() },
        },
        {
          provide: RateLimitingService,
          useValue: {
            checkIpLimit: jest.fn().mockReturnValue(allowedRateLimit),
            check: jest.fn().mockReturnValue(allowedRateLimit),
            buildKey: jest.fn().mockReturnValue('test-key'),
            PROFILES: {
              AUTH: { maxRequests: 5 },
              PHI_ACCESS: { maxRequests: 30 },
              DEVICE_TELEMETRY: { maxRequests: 300 },
              API_GENERAL: { maxRequests: 100 },
              AUDIT_QUERY: { maxRequests: 20 },
              INCIDENT_REPORT: { maxRequests: 50 },
              ADMIN: { maxRequests: 10 },
              BREACH_NOTIFICATION: { maxRequests: 200 },
            },
          },
        },
      ],
    }).compile();

    middleware = module.get<HealthcareSecurityMiddleware>(HealthcareSecurityMiddleware);
    auditService = module.get(AuditService);
    rateLimitingService = module.get(RateLimitingService);
  });

  it('should call next() for allowed requests', async () => {
    const req = mockReq({ path: '/api/data' });
    const res = mockRes();
    const next = jest.fn();

    await middleware.use(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 429 when IP rate limit exceeded', async () => {
    rateLimitingService.checkIpLimit.mockReturnValue({ ...allowedRateLimit, allowed: false, resetAt: new Date() });

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await middleware.use(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 429 when path rate limit exceeded', async () => {
    rateLimitingService.checkIpLimit.mockReturnValue(allowedRateLimit);
    rateLimitingService.check.mockReturnValue({ ...allowedRateLimit, allowed: false, resetAt: new Date() });

    const req = mockReq({ path: '/patients/123' });
    const res = mockRes();
    const next = jest.fn();

    await middleware.use(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.RATE_LIMIT_EXCEEDED }),
    );
  });

  it('should audit PHI access for /patients path', async () => {
    const req = mockReq({ path: '/patients/123', user: { id: 'user-1', role: 'physician' } });
    const res = mockRes();
    const next = jest.fn();

    await middleware.use(req as any, res as any, next);

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.PHI_ACCESS }),
    );
  });

  it('should NOT audit PHI for non-PHI paths', async () => {
    const req = mockReq({ path: '/health' });
    const res = mockRes();
    const next = jest.fn();

    await middleware.use(req as any, res as any, next);

    const phiCall = (auditService.log as jest.Mock).mock.calls.find(
      (call: unknown[]) => (call[0] as { action: AuditAction }).action === AuditAction.PHI_ACCESS,
    );
    expect(phiCall).toBeUndefined();
  });

  it('should detect and log SQL injection attempt', async () => {
    const req = mockReq({ path: '/patients', query: { filter: "' UNION SELECT * FROM users --" } });
    const res = mockRes();
    const next = jest.fn();

    await middleware.use(req as any, res as any, next);

    expect(auditService.logSecurityViolation).toHaveBeenCalled();
  });

  it('should detect path traversal attempt', async () => {
    const req = mockReq({ path: '/patients/../../etc/passwd' });
    const res = mockRes();
    const next = jest.fn();

    await middleware.use(req as any, res as any, next);

    expect(auditService.logSecurityViolation).toHaveBeenCalled();
  });

  it('should set rate limit headers', async () => {
    const req = mockReq({ path: '/api/data' });
    const res = mockRes();
    const next = jest.fn();

    await middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });

  it('should extract X-Forwarded-For IP', async () => {
    const req = mockReq({
      path: '/patients/123',
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
      user: { id: 'user-1', role: 'physician' },
    });
    const res = mockRes();
    const next = jest.fn();

    await middleware.use(req as any, res as any, next);

    expect(rateLimitingService.checkIpLimit).toHaveBeenCalledWith('203.0.113.10');
  });
});
