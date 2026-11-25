import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmergencyMedicalInfoController } from './emergency-medical-info.controller';
import { EmergencyMedicalInfoService } from '../services/emergency-medical-info.service';
import { EmergencyAccessService } from '../services/emergency-access.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BloodType } from '../entities/emergency-medical-info.entity';
import { Patient } from '../../users/entities/patient.entity';

const PATIENT_A = { id: 'patient-a', userId: 'user-a', user: { organizationId: 'org-1' } };
const PATIENT_B = { id: 'patient-b', userId: 'user-b', user: { organizationId: 'org-1' } };

const userA = { userId: 'user-a', role: 'patient', organizationId: 'org-1' };
const nurseSameOrg = { userId: 'nurse-1', role: 'nurse', organizationId: 'org-1' };
const nurseOtherOrg = { userId: 'nurse-2', role: 'nurse', organizationId: 'org-2' };

const recordB = {
  id: 'emi-b',
  patientId: PATIENT_B.id,
  bloodType: BloodType.O_POS,
  allergies: ['penicillin'],
  currentMedications: [],
  chronicConditions: [],
  dnrStatus: false,
  emergencyContacts: [],
  insuranceInfo: null,
  additionalNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildMockService() {
  return {
    create: jest.fn().mockImplementation(async (dto) => ({ ...recordB, ...dto })),
    findByPatient: jest.fn().mockResolvedValue(recordB),
    findById: jest.fn().mockResolvedValue(recordB),
    update: jest.fn().mockResolvedValue(recordB),
    getHistory: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

function buildPatientRepo() {
  const patients = [PATIENT_A, PATIENT_B];
  return {
    findOne: jest.fn().mockImplementation(async ({ where }) => {
      if (where.userId) return patients.find((p) => p.userId === where.userId) ?? null;
      if (where.id) return patients.find((p) => p.id === where.id) ?? null;
      return null;
    }),
  };
}

async function buildController(serviceMock = buildMockService()) {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [EmergencyMedicalInfoController],
    providers: [
      EmergencyAccessService,
      { provide: EmergencyMedicalInfoService, useValue: serviceMock },
      { provide: getRepositoryToken(Patient), useValue: buildPatientRepo() },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return { controller: module.get(EmergencyMedicalInfoController), serviceMock };
}

const req = (user: any) => ({ user });

describe('EmergencyMedicalInfoController', () => {
  it('is protected by JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', EmergencyMedicalInfoController);
    const guardNames = (guards ?? []).map((g: any) => g.name ?? g?.constructor?.name ?? String(g));
    expect(guardNames).toContain('JwtAuthGuard');
  });

  describe('user A acting on patient B gets 403 on every route', () => {
    it('POST / with patientId of B', async () => {
      const { controller, serviceMock } = await buildController();
      await expect(
        controller.create({ patientId: PATIENT_B.id } as any, req(userA)),
      ).rejects.toThrow(ForbiddenException);
      expect(serviceMock.create).not.toHaveBeenCalled();
    });

    it('GET /patient/:patientId', async () => {
      const { controller, serviceMock } = await buildController();
      await expect(controller.findByPatient(PATIENT_B.id, req(userA))).rejects.toThrow(
        ForbiddenException,
      );
      expect(serviceMock.findByPatient).not.toHaveBeenCalled();
    });

    it('GET /:id', async () => {
      const { controller } = await buildController();
      await expect(controller.findById(recordB.id, req(userA))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('PUT /patient/:patientId', async () => {
      const { controller, serviceMock } = await buildController();
      await expect(
        controller.update(PATIENT_B.id, { bloodType: BloodType.A_POS } as any, req(userA)),
      ).rejects.toThrow(ForbiddenException);
      expect(serviceMock.update).not.toHaveBeenCalled();
    });

    it('GET /patient/:patientId/history', async () => {
      const { controller, serviceMock } = await buildController();
      await expect(controller.getHistory(PATIENT_B.id, req(userA))).rejects.toThrow(
        ForbiddenException,
      );
      expect(serviceMock.getHistory).not.toHaveBeenCalled();
    });

    it('DELETE /patient/:patientId', async () => {
      const { controller, serviceMock } = await buildController();
      await expect(controller.remove(PATIENT_B.id, req(userA))).rejects.toThrow(
        ForbiddenException,
      );
      expect(serviceMock.remove).not.toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('takes the patient from the authenticated principal for patients', async () => {
      const { controller, serviceMock } = await buildController();

      await controller.create({ bloodType: BloodType.O_POS } as any, req(userA));

      expect(serviceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: PATIENT_A.id }),
      );
    });

    it('lets clinical staff in the same tenant create for a patient', async () => {
      const { controller, serviceMock } = await buildController();
      const dto = { patientId: PATIENT_B.id, bloodType: BloodType.O_POS };

      await controller.create(dto as any, req(nurseSameOrg));

      expect(serviceMock.create).toHaveBeenCalledWith(dto);
    });

    it('rejects clinical staff from another tenant', async () => {
      const { controller } = await buildController();
      await expect(
        controller.create({ patientId: PATIENT_B.id } as any, req(nurseOtherOrg)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propagates ConflictException from service', async () => {
      const svc = buildMockService();
      svc.create.mockRejectedValue(new ConflictException('already exists'));
      const { controller } = await buildController(svc);

      await expect(controller.create({} as any, req(userA))).rejects.toThrow(ConflictException);
    });
  });

  describe('allowed access', () => {
    it('the patient can read their own record', async () => {
      const { controller, serviceMock } = await buildController();
      const userB = { userId: PATIENT_B.userId, role: 'patient', organizationId: 'org-1' };

      const result = await controller.findByPatient(PATIENT_B.id, req(userB));

      expect(serviceMock.findByPatient).toHaveBeenCalledWith(PATIENT_B.id);
      expect(result).toBe(recordB);
    });

    it('clinical staff in the same tenant can update, with the actor recorded', async () => {
      const { controller, serviceMock } = await buildController();
      const dto = { bloodType: BloodType.A_POS };

      await controller.update(PATIENT_B.id, dto as any, req(nurseSameOrg));

      expect(serviceMock.update).toHaveBeenCalledWith(PATIENT_B.id, dto, nurseSameOrg.userId);
    });

    it('clinical staff from another tenant are rejected', async () => {
      const { controller } = await buildController();
      await expect(controller.findByPatient(PATIENT_B.id, req(nurseOtherOrg))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('propagates NotFoundException when record missing', async () => {
      const svc = buildMockService();
      svc.findById.mockRejectedValue(new NotFoundException());
      const { controller } = await buildController(svc);

      await expect(controller.findById('unknown', req(userA))).rejects.toThrow(NotFoundException);
    });
  });
});
