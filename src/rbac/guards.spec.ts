import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { HipaaAccessGuard, HIPAA_ROLES_KEY } from '../hipaa-access.guard';
import { DeviceAuthGuard } from '../device-auth.guard';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../entities/audit-log.entity';

const makeContext = (overrides: Partial<{
  user: { id: string; role: string };
  path: string;
  method: string;
  headers: Record<string, string>;
  ip: string;
}> = {}): ExecutionContext => {
  const req = {
    user: overrides.user,
    path: overrides.path || '/patients/123',
    method: overrides.method || 'GET',
    headers: overrides.headers || {},
    ip: overrides.ip || '1.2.3.4',
    correlationId: 'corr-123',
  };

  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
};

describe('HipaaAccessGuard', () => {
  let guard: HipaaAccessGuard;
  let reflector: jest.Mocked<Reflector>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HipaaAccessGuard,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    guard = module.get<HipaaAccessGuard>(HipaaAccessGuard);
    reflector = module.get(Reflector);
    auditService = module.get(AuditService);
  });

  it('should allow access when no roles required', async () => {
    reflector.getAllAndOverride.mockReturnValue(null);
    const ctx = makeContext({ user: { id: 'u1', role: 'physician' } });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should allow access when user has required role', async () => {
    reflector.getAllAndOverride.mockReturnValue(['physician', 'nurse']);
    const ctx = makeContext({ user: { id: 'u1', role: 'physician' } });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should deny access when user lacks required role', async () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = makeContext({ user: { id: 'u1', role: 'nurse' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should deny access when no user present', async () => {
    reflector.getAllAndOverride.mockReturnValue(['physician']);
    const ctx = makeContext({ user: undefined });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should audit PERMISSION_DENIED when access denied', async () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = makeContext({ user: { id: 'u1', role: 'nurse' } });

    try {
      await guard.canActivate(ctx);
    } catch {}

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.PERMISSION_DENIED }),
    );
  });

  it('should audit no event when access is allowed', async () => {
    reflector.getAllAndOverride.mockReturnValue(['physician']);
    const ctx = makeContext({ user: { id: 'u1', role: 'physician' } });

    await guard.canActivate(ctx);

    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('should include user role in audit log when denied', async () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = makeContext({ user: { id: 'u1', role: 'viewer' } });

    try {
      await guard.canActivate(ctx);
    } catch {}

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ userRole: 'viewer' }),
    );
  });
});

describe('DeviceAuthGuard', () => {
  let guard: DeviceAuthGuard;

  beforeEach(() => {
    guard = new DeviceAuthGuard();
  });

  const makeDeviceContext = (headers: Record<string, string>) => {
    const req = { headers, deviceId: undefined as string | undefined };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  };

  it('should allow when device token and ID present', () => {
    const ctx = makeDeviceContext({
      'x-device-token': 'valid-token',
      'x-device-id': 'device-uuid',
    });

    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should deny when device token missing', () => {
    const ctx = makeDeviceContext({ 'x-device-id': 'device-uuid' });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny when device ID missing', () => {
    const ctx = makeDeviceContext({ 'x-device-token': 'valid-token' });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny when both headers missing', () => {
    const ctx = makeDeviceContext({});

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should set deviceId on request', () => {
    const req = {
      headers: { 'x-device-token': 'tok', 'x-device-id': 'dev-123' },
      deviceId: undefined as string | undefined,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    guard.canActivate(ctx);
    expect(req.deviceId).toBe('dev-123');
  });
});
