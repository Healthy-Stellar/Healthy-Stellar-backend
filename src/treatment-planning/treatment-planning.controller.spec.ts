jest.mock('jsondiffpatch', () => ({
  create: () => ({
    diff: () => ({}),
  }),
}));

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
          id: 'user-uuid-123',
          role: 'doctor',
        },
      };
      const planId = 'plan-uuid-abc';
      const updateDto = { notes: 'Updated notes' } as any;

      const result = await controller.updatePlan(planId, updateDto, mockReq as any);

      expect(service.savePlan).toHaveBeenCalledWith(planId, updateDto, 'user-uuid-123');
      expect(result).toHaveProperty('authorId', 'user-uuid-123');
    });

    it('should fallback to sub if id is missing in req.user', async () => {
      const mockReq = {
        user: {
          sub: 'sub-uuid-456',
          role: 'doctor',
        },
      };
      const planId = 'plan-uuid-abc';
      const updateDto = { notes: 'Updated notes' } as any;

      const result = await controller.updatePlan(planId, updateDto, mockReq as any);

      expect(service.savePlan).toHaveBeenCalledWith(planId, updateDto, 'sub-uuid-456');
      expect(result).toHaveProperty('authorId', 'sub-uuid-456');
    });
  });

  describe('revertToVersion', () => {
    it('should extract userId from req.user and pass as authorId to service', async () => {
      const mockReq = {
        user: {
          id: 'reverter-uuid-789',
          role: 'doctor',
        },
      };
      const planId = 'plan-uuid-abc';
      const version = 2;

      const result = await controller.revertToVersion(planId, version, mockReq as any);

      expect(service.revertToVersion).toHaveBeenCalledWith(planId, version, 'reverter-uuid-789');
      expect(result).toHaveProperty('authorId', 'reverter-uuid-789');
    });
  });
});
