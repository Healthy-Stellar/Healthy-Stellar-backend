/**
 * Tests for LaboratoryController (stub removal) and LabResultsController (#1119):
 *   - Colliding stub routes removed from LaboratoryController
 *   - Guards re-enabled on LabResultsController
 *   - POST /laboratory/results now persists via real LabResultsService
 *
 * Factory mocks prevent entity/DTO modules from being loaded, avoiding
 * the class-validator Stage-3 decorator incompatibility with isolatedModules:true.
 */

// ── Factory mocks (hoisted before all imports) ─────────────────────────────
jest.mock('../dto/create-lab-result.dto', () => ({
  CreateLabResultDto: class {},
  CreateLabResultValueDto: class {},
  ResultStatus: {
    PRELIMINARY: 'preliminary',
    FINAL: 'final',
    CORRECTED: 'corrected',
    CANCELLED: 'cancelled',
  },
}));
jest.mock('../dto/laboratory.dto', () => ({
  CreateLabOrderDto: class {},
  CreateLabResultDto: class {},
  CreateSpecimenDto: class {},
}));
jest.mock('../services/lab-results.service', () => ({
  LabResultsService: class {
    create = jest.fn().mockResolvedValue({ id: 'result-1', status: 'preliminary' });
    findOne = jest.fn().mockResolvedValue({ id: 'result-1', values: [] });
    findByOrderItem = jest.fn().mockResolvedValue({ id: 'result-1' });
    verify = jest.fn().mockResolvedValue({ id: 'result-1', status: 'final' });
    correct = jest.fn().mockResolvedValue({ id: 'result-1', status: 'corrected' });
  },
}));
jest.mock('../services/critical-alerts.service', () => ({
  CriticalAlertsService: class {
    create = jest.fn().mockResolvedValue({ id: 'alert-1' });
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
import { LaboratoryController } from './laboratory.controller';
import { LabResultsController } from './lab-results.controller';
import { LabResultsService } from '../services/lab-results.service';
import { CriticalAlertsService } from '../services/critical-alerts.service';
import { UserRole } from '../../auth/entities/user.entity';

// ── LaboratoryController — stub routes removed ────────────────────────────

describe('LaboratoryController (#1119) — colliding stub routes removed', () => {
  it('does not define createResult (POST /results stub that shadowed LabResultsController)', () => {
    const controller = new LaboratoryController();
    expect((controller as any).createResult).toBeUndefined();
  });

  it('does not define verifyResult (POST /results/:id/verify stub)', () => {
    const controller = new LaboratoryController();
    expect((controller as any).verifyResult).toBeUndefined();
  });

  it('does not define getOrderResults (GET /results/order/:orderId stub)', () => {
    const controller = new LaboratoryController();
    expect((controller as any).getOrderResults).toBeUndefined();
  });

  it('does not define getPatientResults (GET /results/patient/:patientId stub)', () => {
    const controller = new LaboratoryController();
    expect((controller as any).getPatientResults).toBeUndefined();
  });

  it('still exposes legitimate non-colliding routes', () => {
    const controller = new LaboratoryController();
    expect(typeof controller.getTests).toBe('function');
    expect(typeof controller.createOrder).toBe('function');
    expect(typeof controller.createSpecimen).toBe('function');
    expect(typeof controller.getTurnaroundReport).toBe('function');
    expect(typeof controller.getEquipmentStatus).toBe('function');
  });

  it('JwtAuthGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', LaboratoryController) ?? [];
    expect(guards.map((g) => g.name)).toContain('JwtAuthGuard');
  });

  it('RolesGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', LaboratoryController) ?? [];
    expect(guards.map((g) => g.name)).toContain('RolesGuard');
  });
});

// ── LabResultsController — guard re-enabled ───────────────────────────────

describe('LabResultsController (#1119) — guard active, real service', () => {
  let controller: LabResultsController;
  let labResultsService: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [LabResultsController],
      providers: [LabResultsService, CriticalAlertsService],
    }).compile();

    controller = module.get(LabResultsController);
    labResultsService = module.get(LabResultsService);
  });

  it('JwtAuthGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', LabResultsController) ?? [];
    expect(guards.map((g) => g.name)).toContain('JwtAuthGuard');
  });

  it('RolesGuard is applied at class level', () => {
    const guards: Function[] = Reflect.getMetadata('__guards__', LabResultsController) ?? [];
    expect(guards.map((g) => g.name)).toContain('RolesGuard');
  });

  it('class-level Roles includes ADMIN, PHYSICIAN, and NURSE', () => {
    const roles: UserRole[] = Reflect.getMetadata('roles', LabResultsController) ?? [];
    expect(roles).toContain(UserRole.ADMIN);
    expect(roles).toContain(UserRole.PHYSICIAN);
    expect(roles).toContain(UserRole.NURSE);
  });

  it('create() delegates to LabResultsService.create (not a hardcoded stub)', async () => {
    const req = { user: { id: 'dr-1', role: UserRole.PHYSICIAN } };
    const dto: any = { orderItemId: 'item-1', values: [] };

    const result = await controller.create(dto, req);

    expect(labResultsService.create).toHaveBeenCalledWith(dto, 'dr-1');
    expect(result).toEqual({ id: 'result-1', status: 'preliminary' });
    // Confirm it is NOT a hardcoded stub returning 'result-uuid'
    expect(result.id).not.toBe('result-uuid');
  });

  it('verify() delegates to LabResultsService.verify (not a hardcoded stub)', async () => {
    const req = { user: { id: 'dr-1', name: 'Dr. Smith', role: UserRole.PHYSICIAN } };

    const result = await controller.verify('result-1', req);

    expect(labResultsService.verify).toHaveBeenCalledWith('result-1', 'dr-1', 'Dr. Smith');
    expect(result.status).toBe('final');
  });
});
