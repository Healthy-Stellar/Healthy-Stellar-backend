import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MedicalRbacController } from '../controllers/medical-rbac.controller';
import { MedicalDepartment, MedicalPermission, MedicalRole } from '../enums/medical-roles.enum';
import { MedicalUser } from '../interfaces/medical-rbac.interface';
import { EmergencyOverrideService } from '../services/emergency-override.service';
import { MedicalAuditService } from '../services/medical-audit.service';
import { MedicalPermissionsService } from '../services/medical-permissions.service';

const mockPermissionsService = () => ({
  getPermissionsForRoles: jest.fn().mockReturnValue([MedicalPermission.READ_PATIENT_FULL]),
});

const mockAuditService = () => ({
  queryLogs: jest.fn(),
  getEmergencyOverrideLogs: jest.fn(),
  getPatientAccessHistory: jest.fn(),
});

const mockEmergencyOverrideService = () => ({
  activateOverride: jest.fn(),
  getPendingReviews: jest.fn(),
  reviewOverride: jest.fn(),
});

const adminUser = (): MedicalUser => ({
  id: 'admin-1',
  staffId: 'ADMIN-001',
  roles: [MedicalRole.ADMIN],
  department: MedicalDepartment.GENERAL,
});

const doctorUser = (): MedicalUser => ({
  id: 'dr-1',
  staffId: 'DR-001',
  roles: [MedicalRole.DOCTOR],
  department: MedicalDepartment.CARDIOLOGY,
});

describe('MedicalRbacController', () => {
  let controller: MedicalRbacController;
  let permissionsService: ReturnType<typeof mockPermissionsService>;
  let auditService: ReturnType<typeof mockAuditService>;
  let emergencyService: ReturnType<typeof mockEmergencyOverrideService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedicalRbacController],
      providers: [
        { provide: MedicalPermissionsService, useFactory: mockPermissionsService },
        { provide: MedicalAuditService, useFactory: mockAuditService },
        { provide: EmergencyOverrideService, useFactory: mockEmergencyOverrideService },
      ],
    })
      .overrideGuard(require('../guards/medical-rbac.guard').MedicalRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(MedicalRbacController);
    permissionsService = module.get(MedicalPermissionsService);
    auditService = module.get(MedicalAuditService);
    emergencyService = module.get(EmergencyOverrideService);
  });

  describe('activateEmergencyOverride', () => {
    it('delegates to EmergencyOverrideService', async () => {
      const user = doctorUser();
      const dto = {
        patientId: 'patient-1',
        reason: 'Patient unconscious and requires immediate intervention',
      };
      const overrideCtx = { userId: user.id, patientId: dto.patientId };

      emergencyService.activateOverride.mockResolvedValue(overrideCtx);

      const result = await controller.activateEmergencyOverride(user, dto);

      expect(emergencyService.activateOverride).toHaveBeenCalledWith(
        user,
        dto.patientId,
        dto.reason,
      );
      expect(result).toEqual(overrideCtx);
    });
  });

  describe('getPendingOverrides', () => {
    it('delegates to EmergencyOverrideService', async () => {
      const pending = [{ id: 'override-1' }];
      emergencyService.getPendingReviews.mockResolvedValue(pending);

      const result = await controller.getPendingOverrides();
      expect(result).toEqual(pending);
    });
  });

  describe('reviewOverride', () => {
    it('delegates review to EmergencyOverrideService', async () => {
      const user = adminUser();
      const dto = { overrideId: 'override-1', reviewNotes: 'Justified emergency access' };
      const reviewed = { id: 'override-1', reviewedBy: user.id };

      emergencyService.reviewOverride.mockResolvedValue(reviewed);

      const result = await controller.reviewOverride(user, dto);

      expect(emergencyService.reviewOverride).toHaveBeenCalledWith(
        dto.overrideId,
        user.id,
        dto.reviewNotes,
      );
      expect(result).toEqual(reviewed);
    });
  });

  describe('getAuditLogs', () => {
    it('passes query parameters to audit service', async () => {
      const query = { userId: 'user-1', page: 1, limit: 20 };
      auditService.queryLogs.mockResolvedValue({ data: [], total: 0 });

      const result = await controller.getAuditLogs(query);

      expect(auditService.queryLogs).toHaveBeenCalledWith(query);
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('getEmergencyAuditLogs', () => {
    it('delegates to audit service', async () => {
      auditService.getEmergencyOverrideLogs.mockResolvedValue([]);
      const result = await controller.getEmergencyAuditLogs();
      expect(result).toEqual([]);
    });
  });

  describe('getPatientAuditLogs', () => {
    it('delegates to audit service with patient ID', async () => {
      auditService.getPatientAccessHistory.mockResolvedValue([]);
      const result = await controller.getPatientAuditLogs('patient-uuid');
      expect(auditService.getPatientAccessHistory).toHaveBeenCalledWith('patient-uuid');
      expect(result).toEqual([]);
    });
  });

  describe('getMyPermissions', () => {
    it('returns roles, department, specialties, and computed permissions', async () => {
      const user = doctorUser();
      const result = await controller.getMyPermissions(user);

      expect(result).toEqual({
        roles: user.roles,
        department: user.department,
        specialties: user.specialties,
        permissions: expect.any(Array),
      });
      expect(permissionsService.getPermissionsForRoles).toHaveBeenCalledWith(user.roles);
    });
  });
});
