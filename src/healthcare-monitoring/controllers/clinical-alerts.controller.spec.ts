/**
 * Tests for ClinicalAlertsController (#1122):
 *   - Guard applied at class level (no anonymous access)
 *   - userId removed from acknowledge/resolve bodies; uses req.user.id
 *   - Alert creation restricted to ADMIN/SUPER_ADMIN
 *   - Actor spoofing prevention
 *
 * Factory mocks prevent broken notification.service.ts (has orphaned 'main' import)
 * from crashing the test suite.
 */

// ── Factory mocks (hoisted before all imports) ─────────────────────────────
jest.mock('../services/clinical-alert.service', () => ({
  ClinicalAlertService: class {
    getActiveAlerts = jest.fn().mockResolvedValue([]);
    createAlert = jest.fn().mockResolvedValue({ id: 'alert-1' });
    acknowledgeAlert = jest.fn().mockResolvedValue({ id: 'alert-1', acknowledgedBy: 'user-1' });
    resolveAlert = jest.fn().mockResolvedValue({ id: 'alert-1', resolvedBy: 'user-1' });
    getAlertMetrics = jest.fn().mockResolvedValue({});
  },
}));
jest.mock('../services/dashboard.service', () => ({
  DashboardService: class {
    getClinicalDashboard = jest.fn().mockResolvedValue({});
  },
}));
jest.mock('../entities/clinical-alert.entity', () => ({
  AlertType: {
    CRITICAL_VALUE: 'critical_value',
    MEDICATION: 'medication',
    VITAL_SIGN: 'vital_sign',
  },
  AlertPriority: {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
  },
  AlertStatus: {
    ACTIVE: 'active',
    ACKNOWLEDGED: 'acknowledged',
    RESOLVED: 'resolved',
  },
}));
jest.mock('../../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class JwtAuthGuard {
    canActivate() { return true; }
  },
}));
jest.mock('../../auth/guards/roles.guard', () => ({
  RolesGuard: class RolesGuard {
    canActivate() { return true; }
  },
}));
jest.mock('../../auth/decorators/roles.decorator', () => ({
  Roles: (...roles: string[]) => (target: any, key?: string) => {
    if (key) {
      Reflect.defineMetadata('roles', roles, target[key]);
    } else {
      Reflect.defineMetadata('roles', roles, target);
    }
  },
}));

// ── Imports ────────────────────────────────────────────────────────────────
import { Test } from '@nestjs/testing';
import { ClinicalAlertsController } from './clinical-alerts.controller';
import { ClinicalAlertService } from '../services/clinical-alert.service';
import { DashboardService } from '../services/dashboard.service';
import { AlertType, AlertPriority } from '../entities/clinical-alert.entity';
import { UserRole } from '../../auth/entities/user.entity';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ClinicalAlertsController (#1122) — guards, roles & actor spoofing', () => {
  let controller: ClinicalAlertsController;
  let alertService: any;
  let dashboardService: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ClinicalAlertsController],
      providers: [ClinicalAlertService, DashboardService],
    }).compile();

    controller = module.get(ClinicalAlertsController);
    alertService = module.get(ClinicalAlertService);
    dashboardService = module.get(DashboardService);
  });

  // ── Guard metadata ────────────────────────────────────────────────────

  it('JwtAuthGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', ClinicalAlertsController) ?? [];
    expect(guards.map((g) => g.name)).toContain('JwtAuthGuard');
  });

  it('RolesGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', ClinicalAlertsController) ?? [];
    expect(guards.map((g) => g.name)).toContain('RolesGuard');
  });

  // ── Alert creation — admin-only ────────────────────────────────────────

  it('createAlert handler-level Roles contains ADMIN and SUPER_ADMIN only', () => {
    const roles: UserRole[] =
      Reflect.getMetadata('roles', ClinicalAlertsController.prototype.createAlert) ?? [];
    expect(roles).toContain(UserRole.ADMIN);
    expect(roles).toContain(UserRole.SUPER_ADMIN);
    expect(roles).not.toContain(UserRole.NURSE);
    expect(roles).not.toContain(UserRole.PHYSICIAN);
  });

  it('createAlert delegates to ClinicalAlertService', async () => {
    const alertData = {
      alertType: AlertType.CRITICAL_VALUE,
      priority: AlertPriority.CRITICAL,
      title: 'Critical glucose',
      message: 'Glucose 30 mg/dL',
    };
    await controller.createAlert(alertData);
    expect(alertService.createAlert).toHaveBeenCalledWith(alertData);
  });

  // ── Actor spoofing prevention ─────────────────────────────────────────

  it('acknowledgeAlert uses req.user.id — not body.userId', async () => {
    const req = { user: { id: 'real-clinician', role: UserRole.PHYSICIAN } };
    await controller.acknowledgeAlert('alert-1', req);
    expect(alertService.acknowledgeAlert).toHaveBeenCalledWith('alert-1', 'real-clinician');
  });

  it('acknowledgeAlert ignores a spoofed userId (body has no userId param)', async () => {
    const req = { user: { id: 'real-clinician', role: UserRole.PHYSICIAN } };
    // Controller signature: acknowledgeAlert(alertId, req) — no body
    await controller.acknowledgeAlert('alert-1', req);
    expect(alertService.acknowledgeAlert).not.toHaveBeenCalledWith('alert-1', 'attacker-id');
    expect(alertService.acknowledgeAlert).toHaveBeenCalledWith('alert-1', 'real-clinician');
  });

  it('resolveAlert uses req.user.id — not body.userId', async () => {
    const req = { user: { id: 'real-clinician', role: UserRole.PHYSICIAN } };
    const body = { resolutionNotes: 'Treated and resolved' };
    await controller.resolveAlert('alert-1', body, req);
    expect(alertService.resolveAlert).toHaveBeenCalledWith('alert-1', 'real-clinician', body.resolutionNotes);
  });

  it('resolveAlert body does not include userId (no spoofing surface)', async () => {
    const req = { user: { id: 'real-clinician', role: UserRole.PHYSICIAN } };
    // Even if an attacker passes userId in the body object, the controller ignores it
    const body = { resolutionNotes: 'resolved', userId: 'attacker-id' } as any;
    await controller.resolveAlert('alert-1', body, req);
    expect(alertService.resolveAlert).not.toHaveBeenCalledWith('alert-1', 'attacker-id', expect.anything());
    expect(alertService.resolveAlert).toHaveBeenCalledWith('alert-1', 'real-clinician', body.resolutionNotes);
  });

  // ── Role restrictions ─────────────────────────────────────────────────

  it('getActiveAlerts handler-level Roles includes PHYSICIAN and NURSE', () => {
    const roles: UserRole[] =
      Reflect.getMetadata('roles', ClinicalAlertsController.prototype.getActiveAlerts) ?? [];
    expect(roles).toContain(UserRole.PHYSICIAN);
    expect(roles).toContain(UserRole.NURSE);
    expect(roles).toContain(UserRole.ADMIN);
  });

  it('getAlertMetrics handler-level Roles includes ADMIN, PHYSICIAN, and COMPLIANCE_OFFICER', () => {
    const roles: UserRole[] =
      Reflect.getMetadata('roles', ClinicalAlertsController.prototype.getAlertMetrics) ?? [];
    expect(roles).toContain(UserRole.ADMIN);
    expect(roles).toContain(UserRole.PHYSICIAN);
    expect(roles).toContain(UserRole.COMPLIANCE_OFFICER);
  });

  it('acknowledgeAlert handler-level Roles includes NURSE', () => {
    const roles: UserRole[] =
      Reflect.getMetadata('roles', ClinicalAlertsController.prototype.acknowledgeAlert) ?? [];
    expect(roles).toContain(UserRole.NURSE);
    expect(roles).toContain(UserRole.PHYSICIAN);
    expect(roles).toContain(UserRole.ADMIN);
  });

  // ── Handler delegation ────────────────────────────────────────────────

  it('getActiveAlerts delegates to ClinicalAlertService', async () => {
    await controller.getActiveAlerts('ICU', undefined, undefined);
    expect(alertService.getActiveAlerts).toHaveBeenCalledWith({
      department: 'ICU',
      priority: undefined,
      alertType: undefined,
    });
  });

  it('getClinicalDashboard delegates to DashboardService', async () => {
    await controller.getClinicalDashboard();
    expect(dashboardService.getClinicalDashboard).toHaveBeenCalled();
  });
});
