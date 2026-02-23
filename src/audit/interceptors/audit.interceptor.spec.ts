import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from '../services/audit.service';
import { AuditAction, ResourceType } from '../dto/audit-event.dto';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: AuditService;

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  const createMockExecutionContext = (method: string, url: string, user?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          url,
          user: user || { id: 'user-123', role: 'DOCTOR' },
          ip: '192.168.1.1',
          headers: {
            'user-agent': 'Mozilla/5.0',
          },
          params: {},
          body: {},
          query: {},
        }),
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
    } as ExecutionContext;
  };

  const createMockCallHandler = (data?: any): CallHandler => {
    return {
      handle: () => of(data || { success: true }),
    } as CallHandler;
  };

  describe('intercept', () => {
    it('should log successful GET request', (done) => {
      const context = createMockExecutionContext('GET', '/records/123');
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            actorId: 'user-123',
            action: AuditAction.RECORD_READ,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            metadata: expect.objectContaining({
              method: 'GET',
              url: '/records/123',
              statusCode: 200,
              success: true,
            }),
          }),
        );
        done();
      });
    });

    it('should log successful POST request', (done) => {
      const context = createMockExecutionContext('POST', '/records');
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.RECORD_CREATE,
          }),
        );
        done();
      });
    });

    it('should log successful PUT request', (done) => {
      const context = createMockExecutionContext('PUT', '/records/123');
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.RECORD_UPDATE,
          }),
        );
        done();
      });
    });

    it('should log successful DELETE request', (done) => {
      const context = createMockExecutionContext('DELETE', '/records/123');
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.RECORD_DELETE,
          }),
        );
        done();
      });
    });

    it('should log failed request', (done) => {
      const context = createMockExecutionContext('GET', '/records/123');
      const error = { status: 403, message: 'Forbidden' };
      const next = {
        handle: () => throwError(() => error),
      } as CallHandler;

      interceptor.intercept(context, next).subscribe({
        error: () => {
          expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              action: AuditAction.ACCESS_DENIED,
              metadata: expect.objectContaining({
                success: false,
                error: 'Forbidden',
                statusCode: 403,
              }),
            }),
          );
          done();
        },
      });
    });

    it('should handle anonymous user', (done) => {
      const context = createMockExecutionContext('GET', '/records/123', null);
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            actorId: 'anonymous',
          }),
        );
        done();
      });
    });

    it('should extract resource ID from params', (done) => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'GET',
            url: '/records/record-456',
            user: { id: 'user-123' },
            ip: '192.168.1.1',
            headers: { 'user-agent': 'Mozilla/5.0' },
            params: { id: 'record-456' },
            body: {},
            query: {},
          }),
          getResponse: () => ({
            statusCode: 200,
          }),
        }),
      } as ExecutionContext;

      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceId: 'record-456',
          }),
        );
        done();
      });
    });

    it('should determine resource type from URL', (done) => {
      const context = createMockExecutionContext('GET', '/patients/patient-123');
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceType: ResourceType.PATIENT,
          }),
        );
        done();
      });
    });

    it('should include request duration in metadata', (done) => {
      const context = createMockExecutionContext('GET', '/records/123');
      const next = createMockCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              duration: expect.any(Number),
            }),
          }),
        );
        done();
      });
    });

    it('should include response size in metadata', (done) => {
      const context = createMockExecutionContext('GET', '/records/123');
      const responseData = { id: '123', data: 'test' };
      const next = createMockCallHandler(responseData);

      interceptor.intercept(context, next).subscribe(() => {
        expect(auditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              responseSize: JSON.stringify(responseData).length,
            }),
          }),
        );
        done();
      });
    });
  });

  describe('mapMethodToAction', () => {
    it('should map HTTP methods to audit actions correctly', (done) => {
      const testCases = [
        { method: 'GET', expectedAction: AuditAction.RECORD_READ },
        { method: 'POST', expectedAction: AuditAction.RECORD_CREATE },
        { method: 'PUT', expectedAction: AuditAction.RECORD_UPDATE },
        { method: 'PATCH', expectedAction: AuditAction.RECORD_UPDATE },
        { method: 'DELETE', expectedAction: AuditAction.RECORD_DELETE },
      ];

      let completed = 0;
      testCases.forEach(({ method, expectedAction }) => {
        const context = createMockExecutionContext(method, '/records/123');
        const next = createMockCallHandler();

        interceptor.intercept(context, next).subscribe(() => {
          expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              action: expectedAction,
            }),
          );
          completed++;
          if (completed === testCases.length) {
            done();
          }
        });
      });
    });
  });

  describe('extractResourceInfo', () => {
    it('should extract resource info from different URL patterns', (done) => {
      const testCases = [
        { url: '/records/123', expectedType: ResourceType.RECORD },
        { url: '/patients/456', expectedType: ResourceType.PATIENT },
        { url: '/users/789', expectedType: ResourceType.USER },
        { url: '/access-grants/abc', expectedType: ResourceType.ACCESS_GRANT },
      ];

      let completed = 0;
      testCases.forEach(({ url, expectedType }) => {
        const context = createMockExecutionContext('GET', url);
        const next = createMockCallHandler();

        interceptor.intercept(context, next).subscribe(() => {
          expect(auditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
              resourceType: expectedType,
            }),
          );
          completed++;
          if (completed === testCases.length) {
            done();
          }
        });
      });
    });
  });
});
