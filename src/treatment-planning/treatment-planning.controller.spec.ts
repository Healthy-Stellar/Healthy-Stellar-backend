import { Test, TestingModule } from '@nestjs/testing';
import { TreatmentPlanningController } from './treatment-planning.controller';
import { TreatmentPlanningService } from './treatment-planning.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('TreatmentPlanningController', () => {
  let controller: TreatmentPlanningController;
  let service: Partial<TreatmentPlanningService>;

  beforeEach(async () => {
    service = {
      savePlan: jest.fn().mockImplementation((id, data, authorId) =>
        Promise.resolve({ id, ...data, authorId, updatedAt: new Date() }),
      ),
      getVersions: jest.fn().mockResolvedValue([]),
      getDiff: jest.fn().mockResolvedValue({}),
      revertToVersion: jest.fn().mockImplementation((id, version, authorId) =>
        Promise.resolve({ id, version, authorId }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TreatmentPlanningController],
      providers: [
        {
          provide: TreatmentPlanningService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<TreatmentPlanningController>(TreatmentPlanningController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('updatePlan', () => {
    it('should extract userId from req.user and pass as authorId to service', async () => {
      const mockReq = {
        user: {
          userId: 'doctor-uuid-456',
          email: 'doctor@hospital.org',
        },
      };

      const result = await controller.updatePlan(
        'plan-001',
        { title: 'Cardiology Care Plan', diagnosis: 'Hypertension' },
        mockReq,
      );

      expect(service.savePlan).toHaveBeenCalledWith(
        'plan-001',
        { title: 'Cardiology Care Plan', diagnosis: 'Hypertension' },
        'doctor-uuid-456',
      );
      expect((result as any).authorId).toBe('doctor-uuid-456');
    });

    it('should fall back to req.user.id or system-user if userId is not directly present', async () => {
      const mockReqWithId = {
        user: {
          id: 'user-id-fallback',
        },
      };

      await controller.updatePlan('plan-002', { title: 'Follow-up' }, mockReqWithId);
      expect(service.savePlan).toHaveBeenCalledWith('plan-002', { title: 'Follow-up' }, 'user-id-fallback');

      const mockReqAnonymous = {};
      await controller.updatePlan('plan-003', { title: 'System Plan' }, mockReqAnonymous);
      expect(service.savePlan).toHaveBeenCalledWith('plan-003', { title: 'System Plan' }, 'system-user');
    });
  });

  describe('revertToVersion', () => {
    it('should call revertToVersion with parsed authorId', async () => {
      const mockReq = {
        user: {
          userId: 'doc-789',
        },
      };

      const result = await controller.revertToVersion('plan-001', 2, mockReq);
      expect(service.revertToVersion).toHaveBeenCalledWith('plan-001', 2, 'doc-789');
      expect((result as any).authorId).toBe('doc-789');
    });
  });
});
