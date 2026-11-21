/**
 * Tests for DenialController / AppealController (#1120):
 *   - Both controllers require authentication
 *   - POST /appeals/:id/decision restricted to ADMIN only
 *
 * Factory mocks prevent DTO/entity modules from being loaded, which avoids
 * the Swagger Stage-3 decorator incompatibility with isolatedModules:true.
 */

// ── Factory mocks (hoisted before all imports) ─────────────────────────────
jest.mock('../dto/denial.dto', () => ({
  CreateDenialDto: class {},
  UpdateDenialDto: class {},
  CreateAppealDto: class {},
  UpdateAppealDto: class {},
  DenialSearchDto: class {},
  AppealSearchDto: class {},
}));
jest.mock('../services/denial.service', () => ({
  DenialService: class {
    createDenial = jest.fn().mockResolvedValue({ id: 'denial-1' });
    searchDenials = jest.fn().mockResolvedValue([]);
    getUpcomingDeadlines = jest.fn().mockResolvedValue([]);
    getDenialAnalytics = jest.fn().mockResolvedValue({});
    findDenialById = jest.fn().mockResolvedValue({ id: 'denial-1' });
    updateDenial = jest.fn().mockResolvedValue({ id: 'denial-1' });
    createAppeal = jest.fn().mockResolvedValue({ id: 'appeal-1' });
    searchAppeals = jest.fn().mockResolvedValue([]);
    getPendingAppeals = jest.fn().mockResolvedValue([]);
    findAppealById = jest.fn().mockResolvedValue({ id: 'appeal-1' });
    updateAppeal = jest.fn().mockResolvedValue({ id: 'appeal-1' });
    submitAppeal = jest.fn().mockResolvedValue({ id: 'appeal-1' });
    processAppealDecision = jest.fn().mockResolvedValue({ id: 'appeal-1', approved: true });
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
import { DenialController, AppealController } from './denial.controller';
import { DenialService } from '../services/denial.service';
import { UserRole } from '../../auth/entities/user.entity';

// ── DenialController tests ─────────────────────────────────────────────────

describe('DenialController (#1120) — guards & roles', () => {
  let controller: DenialController;
  let service: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DenialController],
      providers: [DenialService],
    }).compile();

    controller = module.get(DenialController);
    service = module.get(DenialService);
  });

  it('JwtAuthGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', DenialController) ?? [];
    expect(guards.map((g) => g.name)).toContain('JwtAuthGuard');
  });

  it('RolesGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', DenialController) ?? [];
    expect(guards.map((g) => g.name)).toContain('RolesGuard');
  });

  it('class-level Roles includes ADMIN and BILLING_STAFF', () => {
    const roles: UserRole[] = Reflect.getMetadata('roles', DenialController) ?? [];
    expect(roles).toContain(UserRole.ADMIN);
    expect(roles).toContain(UserRole.BILLING_STAFF);
  });

  it('createDenial delegates to DenialService', async () => {
    await controller.createDenial({} as any);
    expect(service.createDenial).toHaveBeenCalled();
  });

  it('searchDenials delegates to DenialService', async () => {
    await controller.searchDenials({} as any);
    expect(service.searchDenials).toHaveBeenCalled();
  });
});

// ── AppealController tests ─────────────────────────────────────────────────

describe('AppealController (#1120) — guards & roles', () => {
  let controller: AppealController;
  let service: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppealController],
      providers: [DenialService],
    }).compile();

    controller = module.get(AppealController);
    service = module.get(DenialService);
  });

  it('JwtAuthGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', AppealController) ?? [];
    expect(guards.map((g) => g.name)).toContain('JwtAuthGuard');
  });

  it('RolesGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', AppealController) ?? [];
    expect(guards.map((g) => g.name)).toContain('RolesGuard');
  });

  it('class-level Roles includes ADMIN and BILLING_STAFF', () => {
    const roles: UserRole[] = Reflect.getMetadata('roles', AppealController) ?? [];
    expect(roles).toContain(UserRole.ADMIN);
    expect(roles).toContain(UserRole.BILLING_STAFF);
  });

  it('processAppealDecision handler-level Roles restricts to ADMIN only', () => {
    const roles: UserRole[] =
      Reflect.getMetadata('roles', AppealController.prototype.processAppealDecision) ?? [];
    expect(roles).toEqual([UserRole.ADMIN]);
    expect(roles).not.toContain(UserRole.BILLING_STAFF);
  });

  it('processAppealDecision delegates to DenialService', async () => {
    await controller.processAppealDecision('appeal-1', {
      approved: true,
      approvedAmount: 500,
      payerResponse: 'Approved upon review',
    });
    expect(service.processAppealDecision).toHaveBeenCalledWith('appeal-1', expect.any(Object));
  });

  it('submitAppeal delegates to DenialService', async () => {
    await controller.submitAppeal('appeal-1');
    expect(service.submitAppeal).toHaveBeenCalledWith('appeal-1');
  });
});
