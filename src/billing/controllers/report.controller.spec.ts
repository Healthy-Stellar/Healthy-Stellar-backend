/**
 * Tests for ReportController (#1121):
 *   - All endpoints require authentication (JwtAuthGuard)
 *   - Finance/admin roles required at class level
 *   - compliance/audit-trail restricted to COMPLIANCE_OFFICER and ADMIN
 *
 * Uses jest.mock to prevent stale .js compiled files with broken Stage-3
 * decorator syntax from crashing the test suite.
 */

// ── Factory mocks (hoisted before all imports) ─────────────────────────────
jest.mock('../dto/report.dto', () => ({
  ReportType: { REVENUE: 'revenue', CLAIMS: 'claims' },
  PeriodType: { MONTHLY: 'monthly', QUARTERLY: 'quarterly' },
  GenerateReportDto: class {},
  ReportScheduleDto: class {},
  ExportReportDto: class {},
}));
jest.mock('../services/report.service', () => ({
  ReportService: class {
    getRevenueCycleMetrics = jest.fn().mockResolvedValue({});
    getProfitabilityAnalysis = jest.fn().mockResolvedValue({});
    getPayerMixAnalysis = jest.fn().mockResolvedValue({});
    getCashFlowProjection = jest.fn().mockResolvedValue({});
    getProductivityReport = jest.fn().mockResolvedValue({});
    getCostAccountingReport = jest.fn().mockResolvedValue({});
    getBenchmarkComparison = jest.fn().mockResolvedValue({});
    getDashboard = jest.fn().mockResolvedValue({});
    exportReport = jest.fn().mockResolvedValue({});
    getAuditTrail = jest.fn().mockResolvedValue([]);
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
import { ReportController } from './report.controller';
import { ReportService } from '../services/report.service';
import { UserRole } from '../../auth/entities/user.entity';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ReportController (#1121) — guards & roles', () => {
  let controller: ReportController;
  let service: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [ReportService],
    }).compile();

    controller = module.get(ReportController);
    service = module.get(ReportService);
  });

  // ── Guard metadata ──────────────────────────────────────────────────────

  it('JwtAuthGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', ReportController) ?? [];
    expect(guards.map((g) => g.name)).toContain('JwtAuthGuard');
  });

  it('RolesGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', ReportController) ?? [];
    expect(guards.map((g) => g.name)).toContain('RolesGuard');
  });

  it('class-level Roles includes ADMIN, BILLING_STAFF, and COMPLIANCE_OFFICER', () => {
    const roles: UserRole[] = Reflect.getMetadata('roles', ReportController) ?? [];
    expect(roles).toContain(UserRole.ADMIN);
    expect(roles).toContain(UserRole.BILLING_STAFF);
    expect(roles).toContain(UserRole.COMPLIANCE_OFFICER);
  });

  // ── Audit-trail restricted roles ────────────────────────────────────────

  it('audit-trail handler restricts roles to COMPLIANCE_OFFICER and ADMIN only', () => {
    const roles: UserRole[] =
      Reflect.getMetadata('roles', ReportController.prototype.getAuditTrail) ?? [];
    expect(roles).toContain(UserRole.COMPLIANCE_OFFICER);
    expect(roles).toContain(UserRole.ADMIN);
    expect(roles).not.toContain(UserRole.BILLING_STAFF);
  });

  // ── Handler delegation ──────────────────────────────────────────────────

  it('getRevenueCycleMetrics delegates to ReportService', async () => {
    await controller.getRevenueCycleMetrics('2024-01-01', '2024-01-31');
    expect(service.getRevenueCycleMetrics).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
  });

  it('getDashboard delegates to ReportService', async () => {
    await controller.getDashboard();
    expect(service.getDashboard).toHaveBeenCalled();
  });

  it('getAuditTrail delegates to ReportService', async () => {
    await controller.getAuditTrail('2024-01-01', '2024-01-31', 'billing');
    expect(service.getAuditTrail).toHaveBeenCalledWith('2024-01-01', '2024-01-31', 'billing');
  });

  it('exportReport delegates to ReportService', async () => {
    const config = { format: 'pdf', type: 'revenue' };
    await controller.exportReport(config);
    expect(service.exportReport).toHaveBeenCalledWith(config);
  });
});
