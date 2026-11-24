import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ANONYMOUS_ACTOR, PhiAuditInterceptor } from './phi-audit.interceptor';
import { SensitiveAuditAction } from '../entities/sensitive-audit-log.entity';

const makeMockAuditLogService = () => ({
  log: jest.fn().mockResolvedValue({}),
});

const makeMockMetrics = () => ({
  inc: jest.fn(),
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
    user: { userId: 'user-uuid', role: 'DOCTOR', organizationId: 'tenant-1' },
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
  let anonymousRowsCounter: ReturnType<typeof makeMockMetrics>;

  beforeEach(() => {
    auditLogService = makeMockAuditLogService();
    anonymousRowsCounter = makeMockMetrics();
    interceptor = new PhiAuditInterceptor(
      auditLogService as any,
      anonymousRowsCounter as any,
    );
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

  it('captures actorAddress, actorRole and tenantId for an authenticated request', (done) => {
    interceptor
      .intercept(
        makeContext({
          user: { userId: 'user-1', role: 'NURSE', organizationId: 'org-99' },
        }),
        makeHandler(),
      )
      .subscribe(() => {
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            actorAddress: 'user-1',
            actorRole: 'NURSE',
            tenantId: 'org-99',
          }),
        );
        done();
      });
  });

  it('does not alert when an authenticated request is fully attributable', (done) => {
    interceptor
      .intercept(
        makeContext({
          user: { userId: 'user-1', role: 'NURSE', organizationId: 'org-99' },
        }),
        makeHandler(),
      )
      .subscribe(() => {
        expect(anonymousRowsCounter.inc).not.toHaveBeenCalled();
        done();
      });
  });

  // Requirement: every authenticated PHI access must be attributable — a
  // non-anonymous actor and a non-null tenant — for all PHI resource types.
  describe.each([
    ['GET', '/medical-records/abc-123', 'MedicalRecord'],
    ['POST', '/medical-records', 'MedicalRecord'],
    ['PUT', '/medical-records/abc-123', 'MedicalRecord'],
    ['PATCH', '/medical-records/abc-123', 'MedicalRecord'],
    ['DELETE', '/medical-records/abc-123', 'MedicalRecord'],
    ['GET', '/clinical-notes/abc-123', 'ClinicalNote'],
    ['GET', '/ehr/abc-123', 'EHR'],
    ['GET', '/patients/abc-123', 'Patient'],
  ])('authenticated PHI access: %s %s', (method, url, resourceType) => {
    it('records a non-anonymous actor and a non-null tenant', (done) => {
      interceptor
        .intercept(makeContext({ method, url }), makeHandler())
        .subscribe(() => {
          expect(auditLogService.log).toHaveBeenCalledTimes(1);
          const entry = auditLogService.log.mock.calls[0][0];

          // Actor must be the real user id, never the anonymous placeholder.
          expect(entry.actorAddress).toBe('user-uuid');
          expect(entry.actorAddress).not.toBe(ANONYMOUS_ACTOR);

          // Tenant must come from the principal's organizationId.
          expect(entry.tenantId).toBe('tenant-1');
          expect(entry.tenantId).not.toBeNull();
          expect(entry.tenantId).not.toBeUndefined();

          expect(entry.resourceType).toBe(resourceType);
          expect(anonymousRowsCounter.inc).not.toHaveBeenCalled();
          done();
        });
    });
  });

  it('fails loudly when an authenticated request has no resolvable actor', (done) => {
    interceptor
      .intercept(
        makeContext({ user: { role: 'DOCTOR', organizationId: 'org-99' } }),
        makeHandler(),
      )
      .subscribe(() => {
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({ actorAddress: ANONYMOUS_ACTOR }),
        );
        expect(anonymousRowsCounter.inc).toHaveBeenCalledWith({ reason: 'missing_actor' });
        done();
      });
  });

  it('fails loudly when an authenticated request has no tenant', (done) => {
    interceptor
      .intercept(
        makeContext({ user: { userId: 'user-1', role: 'DOCTOR' } }),
        makeHandler(),
      )
      .subscribe(() => {
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({ tenantId: null }),
        );
        expect(anonymousRowsCounter.inc).toHaveBeenCalledWith({ reason: 'missing_tenant' });
        done();
      });
  });

  it('does not alert for unauthenticated requests', (done) => {
    interceptor
      .intercept(makeContext({ user: undefined }), makeHandler())
      .subscribe(() => {
        expect(anonymousRowsCounter.inc).not.toHaveBeenCalled();
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
          expect.objectContaining({ actorAddress: ANONYMOUS_ACTOR }),
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
