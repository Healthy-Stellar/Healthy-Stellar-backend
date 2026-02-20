import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUDIT_RESOURCE_KEY,
  EMERGENCY_OVERRIDE_KEY,
  MEDICAL_DEPARTMENT_KEY,
  MEDICAL_PERMISSIONS_KEY,
  MEDICAL_ROLES_KEY,
  MEDICAL_SPECIALTY_KEY,
} from '../decorators/medical-rbac.decorator';
import { MedicalDepartment, MedicalPermission, MedicalRole } from '../enums/medical-roles.enum';
import { MedicalRbacGuard } from '../guards/medical-rbac.guard';
import { MedicalUser } from '../interfaces/medical-rbac.interface';
import { EmergencyOverrideService } from '../services/emergency-override.service';
import { MedicalAuditService } from '../services/medical-audit.service';
import { MedicalPermissionsService } from '../services/medical-permissions.service';

const makeContext = (user: MedicalUser | null, metadata: Record<string, unknown> = {}, params: Record<string, string> = {}): ExecutionContext => {
  const request = { medicalUser: user, params, ip: '127.0.0.1' };

  const reflector = {
    getAllAndOverride: jest.fn((key: string) => metadata[key] ?? undefined),
  } as unknown as Reflector;

  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({ name: 'testHandler' }),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { ctx, reflector, request } as any;
};

describe('MedicalRbacGuard', () => {
  let guard: MedicalRbacGuard;
  let reflector: jest.Mocked<Reflector>;
  let permissionsService: MedicalPermissionsService;
  let auditService: jest.Mocked<MedicalAuditService>;
  let emergencyOverrideService: jest.Mocked<EmergencyOverrideService>;

  const buildGuard = (metadata: Record<string, unknown> = {}) => {
    reflector = {
      getAllAndOverride: jest.fn((key: string) => metadata[key] ?? undefined),
    } as any;

    permissionsService = new MedicalPermissionsService();

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
      logAccessDenied: jest.fn().mockResolvedValue(undefined),
    } as any;

    emergencyOverrideService = {
      hasActiveOverride: jest.fn().mockResolvedValue(false),
    } as any;

    guard = new MedicalRbacGuard(
      reflector,
      permissionsService,
      auditService,
      emergencyOverrideService,
    );

    return guard;
  };

  const makeCtx = (
    user: MedicalUser | null,
    params: Record<string, string> = {},
  ): ExecutionContext => {
    const request = { medicalUser: user, params, ip: '10.0.0.1', body: {} };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({ name: 'testHandler' }),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  // ─── No user ─────────────────────────────────────────────────────────────

  it('throws UnauthorizedException when no user on request', async () => {
    buildGuard();
    const ctx = makeCtx(null);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  // ─── Role checks ─────────────────────────────────────────────────────────

  it('allows access when user has required role', async () => {
    buildGuard({ [MEDICAL_ROLES_KEY]: [MedicalRole.DOCTOR] });

    const user: MedicalUser = {
      id: 'u1',
      staffId: 'DR-001',
      roles: [MedicalRole.DOCTOR],
      department: MedicalDepartment.GENERAL,
    };

    const result = await guard.canActivate(makeCtx(user));
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when user lacks required role', async () => {
    buildGuard({ [MEDICAL_ROLES_KEY]: [MedicalRole.ADMIN] });

    const user: MedicalUser = {
      id: 'u1',
      staffId: 'NR-001',
      roles: [MedicalRole.NURSE],
      department: MedicalDepartment.GENERAL,
    };

    await expect(guard.canActivate(makeCtx(user))).rejects.toThrow(ForbiddenException);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, action: 'PERMISSION_DENIED' }),
    );
  });

  // ─── Permission checks ────────────────────────────────────────────────────

  it('allows access when user has all required permissions', async () => {
    buildGuard({
      [MEDICAL_PERMISSIONS_KEY]: [MedicalPermission.DISPENSE_MEDICATIONS],
    });

    const user: MedicalUser = {
      id: 'u1',
      staffId: 'PH-001',
      roles: [MedicalRole.PHARMACIST],
      department: MedicalDepartment.PHARMACY,
    };

    const result = await guard.canActivate(makeCtx(user));
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when user lacks a required permission', async () => {
    buildGuard({
      [MEDICAL_PERMISSIONS_KEY]: [MedicalPermission.EMERGENCY_OVERRIDE],
    });

    const user: MedicalUser = {
      id: 'u1',
      staffId: 'NR-001',
      roles: [MedicalRole.NURSE],
      department: MedicalDepartment.GENERAL,
    };

    await expect(guard.canActivate(makeCtx(user))).rejects.toThrow(ForbiddenException);
  });

  // ─── Department checks ────────────────────────────────────────────────────

  it('allows access when user can access the required department', async () => {
    buildGuard({ [MEDICAL_DEPARTMENT_KEY]: [MedicalDepartment.PHARMACY] });

    const user: MedicalUser = {
      id: 'u1',
      staffId: 'PH-001',
      roles: [MedicalRole.PHARMACIST],
      department: MedicalDepartment.PHARMACY,
    };

    const result = await guard.canActivate(makeCtx(user));
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when user cannot access required department', async () => {
    buildGuard({ [MEDICAL_DEPARTMENT_KEY]: [MedicalDepartment.SURGERY] });

    const user: MedicalUser = {
      id: 'u1',
      staffId: 'PH-001',
      roles: [MedicalRole.PHARMACIST],
      department: MedicalDepartment.PHARMACY,
    };

    await expect(guard.canActivate(makeCtx(user))).rejects.toThrow(ForbiddenException);
  });

  // ─── Emergency override bypass ────────────────────────────────────────────

  it('allows access via emergency override when override is active', async () => {
    emergencyOverrideService.hasActiveOverride.mockResolvedValue(true);

    buildGuard({
      [MEDICAL_DEPARTMENT_KEY]: [MedicalDepartment.SURGERY],
      [EMERGENCY_OVERRIDE_KEY]: true,
    });
    // re-assign because buildGuard re-creates the guard with fresh mocks
    (guard as any).emergencyOverrideService = emergencyOverrideService;

    const ctx = makeCtx(
      {
        id: 'u1',
        staffId: 'NR-001',
        roles: [MedicalRole.NURSE],
        department: MedicalDepartment.GENERAL,
      },
      { patientId: 'patient-xyz' },
    );

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(emergencyOverrideService.hasActiveOverride).toHaveBeenCalledWith('u1', 'patient-xyz');
  });

  it('throws ForbiddenException when emergency override is not active', async () => {
    emergencyOverrideService.hasActiveOverride.mockResolvedValue(false);

    buildGuard({
      [MEDICAL_DEPARTMENT_KEY]: [MedicalDepartment.SURGERY],
      [EMERGENCY_OVERRIDE_KEY]: true,
    });
    (guard as any).emergencyOverrideService = emergencyOverrideService;

    const user: MedicalUser = {
      id: 'u1',
      staffId: 'NR-001',
      roles: [MedicalRole.NURSE],
      department: MedicalDepartment.GENERAL,
    };

    await expect(guard.canActivate(makeCtx(user, { patientId: 'patient-xyz' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  // ─── Audit trail ──────────────────────────────────────────────────────────

  it('logs successful access with correct metadata', async () => {
    buildGuard({});

    const user: MedicalUser = {
      id: 'u1',
      staffId: 'DR-001',
      roles: [MedicalRole.DOCTOR],
      department: MedicalDepartment.CARDIOLOGY,
    };

    await guard.canActivate(makeCtx(user));

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        staffId: 'DR-001',
        success: true,
        isEmergencyOverride: false,
      }),
    );
  });

  it('logs failed access with failure reason', async () => {
    buildGuard({ [MEDICAL_ROLES_KEY]: [MedicalRole.ADMIN] });

    const user: MedicalUser = {
      id: 'u1',
      staffId: 'NR-001',
      roles: [MedicalRole.NURSE],
      department: MedicalDepartment.GENERAL,
    };

    await expect(guard.canActivate(makeCtx(user))).rejects.toThrow(ForbiddenException);

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        failureReason: 'Insufficient role',
      }),
    );
  });

  // ─── No restrictions ──────────────────────────────────────────────────────

  it('allows access when no restrictions are set on the handler', async () => {
    buildGuard({});

    const user: MedicalUser = {
      id: 'u1',
      staffId: 'ANY-001',
      roles: [MedicalRole.LAB_TECHNICIAN],
      department: MedicalDepartment.LABORATORY,
    };

    const result = await guard.canActivate(makeCtx(user));
    expect(result).toBe(true);
  });
});
