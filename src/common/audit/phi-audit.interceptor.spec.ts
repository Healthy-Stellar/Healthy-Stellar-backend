/**
 * Unit tests for PhiAuditInterceptor
 *
 * Covers:
 *  1. Logs READ action on GET request when @AuditLog metadata is present
 *  2. Logs WRITE action on POST request
 *  3. Logs DELETE action on DELETE request
 *  4. Does NOT log when @AuditLog metadata is absent
 *  5. Does not throw/crash when AuditLogService.log() throws
 *  6. Uses anonymous actorAddress when user is not authenticated
 *  7. Extracts resourceId from URL UUID
 *  8. Passes entityType from @AuditLog decorator as resourceType
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { PhiAuditInterceptor } from './phi-audit.interceptor';
import { AuditLogService } from '../services/audit-log.service';
import { AUDIT_LOG_METADATA_KEY, AuditLogMetadata } from './audit-log.decorator';
import { PhiAuditAction } from './dto/query-audit-logs.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ANONYMOUS_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Builds a minimal ExecutionContext mock.
 *
 * @param method       HTTP method string (GET, POST, …)
 * @param url          Request URL
 * @param userId       User id injected by auth guard (undefined = unauthenticated)
 * @param hasDecorator Whether the handler has the @AuditLog metadata set
 * @param ip           Remote IP address
 * @param forwardedFor Value for the x-forwarded-for header
 */
const buildContext = (
  method: string,
  url: string,
  userId?: string,
  hasDecorator = true,
  ip = '10.0.0.1',
  forwardedFor?: string,
): ExecutionContext => {
  const handler = jest.fn(); // stable handler reference used by Reflector mock
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        url,
        ip,
        user: userId ? { id: userId } : undefined,
        headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
        connection: { remoteAddress: ip },
      }),
    }),
    getHandler: () => handler,
    getClass: () => ({}),
    _hasDecorator: hasDecorator, // consumed by the Reflector spy below
  } as unknown as ExecutionContext;
};

const buildHandler = (): CallHandler => ({ handle: () => of({ ok: true }) });

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe('PhiAuditInterceptor', () => {
  let interceptor: PhiAuditInterceptor;
  let auditLogService: { log: jest.Mock };
  let reflector: { get: jest.Mock };

  beforeEach(async () => {
    auditLogService = { log: jest.fn().mockResolvedValue({ id: 'audit-uuid' }) };
    reflector = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhiAuditInterceptor,
        { provide: AuditLogService, useValue: auditLogService },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    interceptor = module.get<PhiAuditInterceptor>(PhiAuditInterceptor);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // Helper that sets up the Reflector mock and resolves the observable
  // -------------------------------------------------------------------------
  const run = (
    ctx: ExecutionContext,
    metadata?: AuditLogMetadata,
  ): Promise<void> => {
    const contextWithDecorator = ctx as any;
    if (contextWithDecorator._hasDecorator && metadata) {
      reflector.get.mockReturnValue(metadata);
    } else if (contextWithDecorator._hasDecorator && !metadata) {
      // hasDecorator = true but no explicit metadata → use default
      reflector.get.mockReturnValue({
        operation: 'READ',
        entityType: 'MedicalRecord',
      } as AuditLogMetadata);
    } else {
      reflector.get.mockReturnValue(undefined);
    }

    return new Promise((resolve, reject) => {
      interceptor.intercept(ctx, buildHandler()).subscribe({
        error: reject,
        complete: () => setTimeout(resolve, 20), // allow tap() async to settle
      });
    });
  };

  // -------------------------------------------------------------------------
  // 1. Logs READ action on GET request when @AuditLog metadata is present
  // -------------------------------------------------------------------------
  it('logs READ action for GET requests with @AuditLog metadata', async () => {
    const ctx = buildContext('GET', '/medical-records', 'user-abc');
    await run(ctx, { operation: 'READ', entityType: 'MedicalRecord' });

    expect(auditLogService.log).toHaveBeenCalledTimes(1);
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PhiAuditAction.READ,
        actorAddress: 'user-abc',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 2. Logs WRITE action on POST request
  // -------------------------------------------------------------------------
  it('logs WRITE action for POST requests', async () => {
    const ctx = buildContext('POST', '/medical-records', 'user-xyz');
    await run(ctx, { operation: 'WRITE', entityType: 'MedicalRecord' });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: PhiAuditAction.WRITE }),
    );
  });

  // -------------------------------------------------------------------------
  // 3. Logs DELETE action on DELETE request
  // -------------------------------------------------------------------------
  it('logs DELETE action for DELETE requests', async () => {
    const ctx = buildContext('DELETE', '/medical-records/some-id', 'user-del');
    await run(ctx, { operation: 'DELETE', entityType: 'MedicalRecord' });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: PhiAuditAction.DELETE }),
    );
  });

  // -------------------------------------------------------------------------
  // 4. Does NOT log when @AuditLog metadata is absent
  // -------------------------------------------------------------------------
  it('skips logging when @AuditLog decorator is absent', async () => {
    const ctx = buildContext('GET', '/medical-records', 'user-abc', false /* no decorator */);
    await run(ctx);

    expect(auditLogService.log).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 5. Does not throw/crash when AuditLogService.log() throws
  // -------------------------------------------------------------------------
  it('does not propagate errors thrown by AuditLogService.log()', async () => {
    auditLogService.log.mockRejectedValueOnce(new Error('DB connection lost'));

    const ctx = buildContext('GET', '/medical-records', 'user-abc');

    // Should resolve cleanly — the interceptor swallows audit errors
    await expect(run(ctx, { operation: 'READ', entityType: 'MedicalRecord' })).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 6. Uses anonymous actorAddress when user is not authenticated
  // -------------------------------------------------------------------------
  it('uses anonymous UUID as actorAddress when no authenticated user', async () => {
    const ctx = buildContext('GET', '/medical-records', undefined /* no user */);
    await run(ctx, { operation: 'READ', entityType: 'MedicalRecord' });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ actorAddress: ANONYMOUS_ID }),
    );
  });

  // -------------------------------------------------------------------------
  // 7. Extracts resourceId from URL UUID
  // -------------------------------------------------------------------------
  it('extracts UUID from the URL and sets it as resourceId', async () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const ctx = buildContext('GET', `/medical-records/${uuid}`, 'user-abc');
    await run(ctx, { operation: 'READ', entityType: 'MedicalRecord' });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: uuid }),
    );
  });

  it('sets resourceId to undefined when the URL contains no UUID', async () => {
    const ctx = buildContext('GET', '/medical-records', 'user-abc');
    await run(ctx, { operation: 'READ', entityType: 'MedicalRecord' });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: undefined }),
    );
  });

  // -------------------------------------------------------------------------
  // 8. Passes entityType from @AuditLog decorator as resourceType
  // -------------------------------------------------------------------------
  it('passes entityType from the decorator metadata as resourceType', async () => {
    const ctx = buildContext('POST', '/clinical-notes', 'user-doc');
    await run(ctx, { operation: 'WRITE', entityType: 'ClinicalNote' });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'ClinicalNote' }),
    );
  });

  // -------------------------------------------------------------------------
  // Additional: PATCH and PUT also map to WRITE
  // -------------------------------------------------------------------------
  it('maps PATCH method to WRITE action', async () => {
    const ctx = buildContext('PATCH', '/medical-records/some-uuid', 'user-abc');
    await run(ctx, { operation: 'WRITE', entityType: 'MedicalRecord' });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: PhiAuditAction.WRITE }),
    );
  });

  it('maps PUT method to WRITE action', async () => {
    const ctx = buildContext('PUT', '/medical-records/some-uuid', 'user-abc');
    await run(ctx, { operation: 'WRITE', entityType: 'MedicalRecord' });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: PhiAuditAction.WRITE }),
    );
  });

  // -------------------------------------------------------------------------
  // Additional: x-forwarded-for IP extraction
  // -------------------------------------------------------------------------
  it('extracts IP from x-forwarded-for header (first address)', async () => {
    const ctx = buildContext('GET', '/medical-records', 'user-abc', true, '10.0.0.1', '203.0.113.5, 10.0.0.1');
    await run(ctx, { operation: 'READ', entityType: 'MedicalRecord' });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: '203.0.113.5' }),
    );
  });

  // -------------------------------------------------------------------------
  // Additional: metadata includes operation, url, method
  // -------------------------------------------------------------------------
  it('includes operation metadata with url and method in the log entry', async () => {
    const ctx = buildContext('POST', '/medical-records', 'user-abc');
    await run(ctx, { operation: 'WRITE', entityType: 'MedicalRecord' });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          operation: 'WRITE',
          url: '/medical-records',
          method: 'POST',
        }),
      }),
    );
  });
});
