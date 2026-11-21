import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { GuardianService } from './guardian.service';
import { PatientGuardian, GuardianshipStatus, GuardianRelationshipType } from '../entities/patient-guardian.entity';
import { Patient } from '../entities/patient.entity';

const mockGuardianRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockPatientRepo = () => ({
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const GUARDIAN_ID = 'guardian-uuid';
const PATIENT_ID = 'patient-uuid';
const ACTOR_ID = 'actor-uuid';
const LINK_ID = 'link-uuid';

describe('GuardianService', () => {
  let service: GuardianService;
  let guardianRepo: ReturnType<typeof mockGuardianRepo>;
  let patientRepo: ReturnType<typeof mockPatientRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuardianService,
        { provide: getRepositoryToken(PatientGuardian), useFactory: mockGuardianRepo },
        { provide: getRepositoryToken(Patient), useFactory: mockPatientRepo },
      ],
    }).compile();

    service = module.get(GuardianService);
    guardianRepo = module.get(getRepositoryToken(PatientGuardian));
    patientRepo = module.get(getRepositoryToken(Patient));
  });

  const baseDto = {
    guardianUserId: GUARDIAN_ID,
    dependentPatientId: PATIENT_ID,
    relationshipType: GuardianRelationshipType.PARENT,
    effectiveFrom: '2024-01-01',
  };

  describe('createLink', () => {
    it('creates a guardian link successfully', async () => {
      patientRepo.findOne.mockResolvedValue({ id: PATIENT_ID });
      guardianRepo.findOne.mockResolvedValue(null);
      guardianRepo.create.mockReturnValue({ ...baseDto, id: LINK_ID, status: GuardianshipStatus.ACTIVE });
      guardianRepo.save.mockResolvedValue({ ...baseDto, id: LINK_ID, status: GuardianshipStatus.ACTIVE });

      const result = await service.createLink(baseDto, ACTOR_ID);
      expect(result.id).toBe(LINK_ID);
      expect(guardianRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when dependent patient does not exist', async () => {
      patientRepo.findOne.mockResolvedValue(null);
      await expect(service.createLink(baseDto, ACTOR_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when active link already exists', async () => {
      patientRepo.findOne.mockResolvedValue({ id: PATIENT_ID });
      guardianRepo.findOne.mockResolvedValue({ id: LINK_ID, status: GuardianshipStatus.ACTIVE });
      await expect(service.createLink(baseDto, ACTOR_ID)).rejects.toThrow(ConflictException);
    });
  });

  describe('revokeLink', () => {
    it('revokes an active guardian link', async () => {
      const link = { id: LINK_ID, status: GuardianshipStatus.ACTIVE };
      guardianRepo.findOne.mockResolvedValue(link);
      guardianRepo.save.mockResolvedValue({ ...link, status: GuardianshipStatus.REVOKED, revokedBy: ACTOR_ID });

      const result = await service.revokeLink(LINK_ID, ACTOR_ID, { reason: 'test' });
      expect(result.status).toBe(GuardianshipStatus.REVOKED);
      expect(result.revokedBy).toBe(ACTOR_ID);
    });

    it('throws NotFoundException when link does not exist', async () => {
      guardianRepo.findOne.mockResolvedValue(null);
      await expect(service.revokeLink(LINK_ID, ACTOR_ID, {})).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when link is already revoked', async () => {
      guardianRepo.findOne.mockResolvedValue({ id: LINK_ID, status: GuardianshipStatus.REVOKED });
      await expect(service.revokeLink(LINK_ID, ACTOR_ID, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('isActiveGuardian', () => {
    it('returns true for an active, non-expired link', async () => {
      guardianRepo.findOne.mockResolvedValue({
        id: LINK_ID,
        status: GuardianshipStatus.ACTIVE,
        effectiveTo: null,
      });
      expect(await service.isActiveGuardian(GUARDIAN_ID, PATIENT_ID)).toBe(true);
    });

    it('returns false when no link exists', async () => {
      guardianRepo.findOne.mockResolvedValue(null);
      expect(await service.isActiveGuardian(GUARDIAN_ID, PATIENT_ID)).toBe(false);
    });

    it('returns false and expires link when effectiveTo has passed', async () => {
      const link = { id: LINK_ID, status: GuardianshipStatus.ACTIVE, effectiveTo: '2000-01-01' };
      guardianRepo.findOne.mockResolvedValue(link);
      guardianRepo.save.mockResolvedValue({ ...link, status: GuardianshipStatus.EXPIRED });

      expect(await service.isActiveGuardian(GUARDIAN_ID, PATIENT_ID)).toBe(false);
      expect(guardianRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: GuardianshipStatus.EXPIRED }));
    });
  });

  describe('expireAgedOutGuardianships', () => {
    it('expires links by effectiveTo date and flags age-of-majority patients', async () => {
      guardianRepo.update.mockResolvedValue({ affected: 2 });

      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: PATIENT_ID }]),
      };
      patientRepo.createQueryBuilder.mockReturnValue(qb);

      // Second update call for age-of-majority patients
      guardianRepo.update
        .mockResolvedValueOnce({ affected: 2 })
        .mockResolvedValueOnce({ affected: 1 });

      const total = await service.expireAgedOutGuardianships();
      expect(total).toBe(3);
    });
  });
});
