import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { AuditInterceptor } from '../../src/common/audit/audit.interceptor';
import { AuditService } from '../../src/common/audit/audit.service';
import { AuditEventAction } from '../../src/common/audit/dto/audit-event.dto';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: { log: jest.Mock };

  beforeEach(async () => {
    auditService = { log: jest.fn(async () => ({})) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
  });

  const buildContext = (method: string, url: string, userId?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          url,
          ip: '10.0.0.1',
          user: userId ? { id: userId } : undefined,
          headers: { 'user-agent': 'test-agent' },
          connection: {},
        }),
      }),
    } as unknown as ExecutionContext);

  const buildHandler = (): CallHandler => ({ handle: () => of({ id: 'record-1' }) });

  it('calls AuditService.log with RECORD_READ on GET', (done) => {
    interceptor
      .intercept(buildContext('GET', '/medical-records/uuid-1', 'actor-1'), buildHandler())
      .subscribe({
        complete: () => {
          setTimeout(() => {
            expect(auditService.log).toHaveBeenCalledWith(
              expect.objectContaining({
                actorId: 'actor-1',
                action: AuditEventAction.RECORD_READ,
                resourceType: 'MedicalRecord',
                ipAddress: '10.0.0.1',
                userAgent: 'test-agent',
              }),
            );
            done();
          }, 10);
        },
      });
  });

  it('calls AuditService.log with RECORD_WRITE on POST', (done) => {
    interceptor
      .intercept(buildContext('POST', '/medical-records', 'actor-2'), buildHandler())
      .subscribe({
        complete: () => {
          setTimeout(() => {
            expect(auditService.log).toHaveBeenCalledWith(
              expect.objectContaining({ action: AuditEventAction.RECORD_WRITE }),
            );
            done();
          }, 10);
        },
      });
  });

  it('uses anonymous actor when no user is authenticated', (done) => {
    interceptor
      .intercept(buildContext('GET', '/medical-records', undefined), buildHandler())
      .subscribe({
        complete: () => {
          setTimeout(() => {
            expect(auditService.log).toHaveBeenCalledWith(
              expect.objectContaining({ actorId: '00000000-0000-0000-0000-000000000000' }),
            );
            done();
          }, 10);
        },
      });
  });

  it('extracts resourceId from URL UUID', (done) => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    interceptor
      .intercept(buildContext('GET', `/medical-records/${uuid}`, 'actor-3'), buildHandler())
      .subscribe({
        complete: () => {
          setTimeout(() => {
            expect(auditService.log).toHaveBeenCalledWith(
              expect.objectContaining({ resourceId: uuid }),
            );
            done();
          }, 10);
        },
      });
  });
});
