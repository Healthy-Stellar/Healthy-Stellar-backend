import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { PhiAuditInterceptor } from './phi-audit.interceptor';
import { SensitiveAuditAction } from '../entities/sensitive-audit-log.entity';

const makeMockAuditLogService = () => ({
  log: jest.fn().mockResolvedValue({}),
});

const makeContext = (overrides: Partial<{
  method: string;
  url: string;
  user: Record<string, any>;
  params: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, any>;
  ip: string;
  headers: Record<string, string>;
}> = {}): ExecutionContext => {
  const request = {
    method: 'GET',
    url: '/medical-records/abc-123',
    user: { id: 'user-uuid', role: 'DOCTOR', tenantId: 'tenant-1' },
    params: {},
    query: {},
    body: {},
    ip: '10.0.0.1',
    headers: { 'user-agent': 'jest' },
    connection: { remoteAddress: '10.0.0.1' },
    ...overrides,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
};

const makeHandler = (): CallHandler => ({
  handle: () => of({ ok: true }),
});

describe('PhiAuditInterceptor', () => {
  let interceptor: PhiAuditInterceptor;
  let auditLogService: ReturnType<typeof makeMockAuditLogService>;

  beforeEach(() => {
    auditLogService = makeMockAuditLogService();
    interceptor = new PhiAuditInterceptor(auditLogService as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('logs PHI_READ for GET requests', (done) => {
    interceptor.intercept(makeContext({ method: 'GET' }), makeHandler()).subscribe(() => {
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: SensitiveAuditAction.PHI_READ }),
      );
      done();
    });
  });

  it('logs PHI_WRITE for POST requests', (done) => {
    interceptor.intercept(makeContext({ method: 'POST' }), makeHandler()).subscribe(() => {
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: SensitiveAuditAction.PHI_WRITE }),
      );
      done();
    });
  });

  it('logs PHI_WRITE for PUT requests', (done) => {
    interceptor.intercept(makeContext({ method: 'PUT' }), makeHandler()).subscribe(() => {
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: SensitiveAuditAction.PHI_WRITE }),
      );
      done();
    });
  });

  it('logs PHI_DELETE for DELETE requests', (done) => {
    interceptor.intercept(makeContext({ method: 'DELETE' }), makeHandler()).subscribe(() => {
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: SensitiveAuditAction.PHI_DELETE }),
      );
      done();
    });
  });

  it('captures actor id, role and tenant from request user', (done) => {
    interceptor
      .intercept(
        makeContext({ user: { id: 'doc-1', role: 'NURSE', tenantId: 'org-99' } }),
        makeHandler(),
      )
      .subscribe(() => {
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            actorAddress: 'doc-1',
            actorRole: 'NURSE',
            tenantId: 'org-99',
          }),
        );
        done();
      });
  });

  it('extracts patientId from query string', (done) => {
    interceptor
      .intercept(
        makeContext({ query: { patientId: 'patient-uuid' } }),
        makeHandler(),
      )
      .subscribe(() => {
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({ patientId: 'patient-uuid' }),
        );
        done();
      });
  });

  it('extracts patientId from request body', (done) => {
    interceptor
      .intercept(
        makeContext({ method: 'POST', body: { patientId: 'body-patient-id' } }),
        makeHandler(),
      )
      .subscribe(() => {
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({ patientId: 'body-patient-id' }),
        );
        done();
      });
  });

  it('extracts patientId from /patients/:uuid URL', (done) => {
    const pid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    interceptor
      .intercept(
        makeContext({ url: `/patients/${pid}` }),
        makeHandler(),
      )
      .subscribe(() => {
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({ patientId: pid }),
        );
        done();
      });
  });

  it('resolves MedicalRecord resource type for medical-records URL', (done) => {
    interceptor
      .intercept(makeContext({ url: '/medical-records/some-id' }), makeHandler())
      .subscribe(() => {
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({ resourceType: 'MedicalRecord' }),
        );
        done();
      });
  });

  it('resolves Patient resource type for patients URL', (done) => {
    interceptor
      .intercept(makeContext({ url: '/patients/some-id' }), makeHandler())
      .subscribe(() => {
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({ resourceType: 'Patient' }),
        );
        done();
      });
  });

  it('defaults actorAddress to "anonymous" when no user on request', (done) => {
    interceptor
      .intercept(makeContext({ user: undefined }), makeHandler())
      .subscribe(() => {
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({ actorAddress: 'anonymous' }),
        );
        done();
      });
  });

  it('does not throw when auditLogService.log rejects', (done) => {
    auditLogService.log.mockRejectedValue(new Error('db error'));
    expect(() =>
      interceptor.intercept(makeContext(), makeHandler()).subscribe({ complete: done }),
    ).not.toThrow();
  });
});
