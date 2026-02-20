import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmergencyOverride } from '../entities/emergency-override.entity';
import { MedicalDepartment, MedicalRole } from '../enums/medical-roles.enum';
import { MedicalUser } from '../interfaces/medical-rbac.interface';
import { MedicalAuditService } from '../services/medical-audit.service';
import { EmergencyOverrideService } from '../services/emergency-override.service';
import { MedicalPermissionsService } from '../services/medical-permissions.service';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const mockAuditService = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

const doctorUser = (): MedicalUser => ({
  id: 'user-1',
  staffId: 'DR-001',
  roles: [MedicalRole.DOCTOR],
  department: MedicalDepartment.EMERGENCY,
});

const nurseUser = (): MedicalUser => ({
  id: 'user-2',
  staffId: 'NR-001',
  roles: [MedicalRole.NURSE],
  department: MedicalDepartment.GENERAL,
});

describe('EmergencyOverrideService', () => {
  let service: EmergencyOverrideService;
  let repo: ReturnType<typeof mockRepo>;
  let auditService: ReturnType<typeof mockAuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyOverrideService,
        MedicalPermissionsService,
        {
          provide: getRepositoryToken(EmergencyOverride),
          useFactory: mockRepo,
        },
        {
          provide: MedicalAuditService,
          useFactory: mockAuditService,
        },
      ],
    }).compile();

    service = module.get(EmergencyOverrideService);
    repo = module.get(getRepositoryToken(EmergencyOverride));
    auditService = module.get(MedicalAuditService);
  });

  // ─── activateOverride ────────────────────────────────────────────────────

  describe('activateOverride', () => {
    it('creates and saves an active override for an authorized doctor', async () => {
      const user = doctorUser();
      const override = {
        id: 'override-1',
        userId: user.id,
        patientId: 'patient-1',
        isActive: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      };

      repo.create.mockReturnValue(override);
      repo.save.mockResolvedValue(override);

      const result = await service.activateOverride(
        user,
        'patient-1',
        'Patient unconscious in ER, unable to obtain consent for urgent cardiac procedure',
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id, patientId: 'patient-1', isActive: true }),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ isEmergencyOverride: true, action: 'EMERGENCY_OVERRIDE' }),
      );
      expect(result.userId).toBe(user.id);
      expect(result.patientId).toBe('patient-1');
    });

    it('throws ForbiddenException for nurses who lack permission', async () => {
      const user = nurseUser();

      await expect(
        service.activateOverride(user, 'patient-1', 'Some reason longer than twenty chars here'),
      ).rejects.toThrow(ForbiddenException);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when reason is too short', async () => {
      const user = doctorUser();

      await expect(service.activateOverride(user, 'patient-1', 'Too short')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when reason is empty', async () => {
      const user = doctorUser();

      await expect(service.activateOverride(user, 'patient-1', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── hasActiveOverride ───────────────────────────────────────────────────

  describe('hasActiveOverride', () => {
    it('returns true when an active, non-expired override exists', async () => {
      repo.findOne.mockResolvedValue({
        id: 'override-1',
        isActive: true,
        expiresAt: new Date(Date.now() + 1_000_000),
      });

      const result = await service.hasActiveOverride('user-1', 'patient-1');
      expect(result).toBe(true);
    });

    it('returns false and deactivates when override is expired', async () => {
      repo.findOne.mockResolvedValue({
        id: 'override-1',
        isActive: true,
        expiresAt: new Date(Date.now() - 1_000),
      });
      repo.update.mockResolvedValue(undefined);

      const result = await service.hasActiveOverride('user-1', 'patient-1');
      expect(result).toBe(false);
      expect(repo.update).toHaveBeenCalledWith('override-1', { isActive: false });
    });

    it('returns false when no override exists', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.hasActiveOverride('user-1', 'patient-1');
      expect(result).toBe(false);
    });
  });

  // ─── getPendingReviews ───────────────────────────────────────────────────

  describe('getPendingReviews', () => {
    it('fetches active overrides without reviewer', async () => {
      repo.find.mockResolvedValue([]);

      await service.getPendingReviews();

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, reviewedBy: null },
        }),
      );
    });
  });

  // ─── reviewOverride ──────────────────────────────────────────────────────

  describe('reviewOverride', () => {
    it('saves review data and logs the action', async () => {
      const existingOverride = {
        id: 'override-1',
        userId: 'user-1',
        patientId: 'patient-1',
        isActive: true,
        reviewedBy: null,
      };
      const reviewed = { ...existingOverride, reviewedBy: 'admin-1' };

      repo.findOne.mockResolvedValue(existingOverride);
      repo.save.mockResolvedValue(reviewed);

      const result = await service.reviewOverride('override-1', 'admin-1', 'Justified override');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ reviewedBy: 'admin-1', reviewNotes: 'Justified override' }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EMERGENCY_OVERRIDE_REVIEWED' }),
      );
      expect(result.reviewedBy).toBe('admin-1');
    });

    it('throws NotFoundException when override does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.reviewOverride('ghost-id', 'admin-1', 'Notes')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── deactivateOverride ──────────────────────────────────────────────────

  describe('deactivateOverride', () => {
    it('sets isActive to false for the matching override', async () => {
      repo.update.mockResolvedValue(undefined);

      await service.deactivateOverride('user-1', 'patient-1');

      expect(repo.update).toHaveBeenCalledWith(
        { userId: 'user-1', patientId: 'patient-1', isActive: true },
        { isActive: false },
      );
    });
  });
});
