import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EmergencyMedicalInfoController } from './emergency-medical-info.controller';
import { EmergencyMedicalInfoService } from '../services/emergency-medical-info.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BloodType } from '../entities/emergency-medical-info.entity';

const mockRecord = {
  id: 'emi-1',
  patientId: 'patient-1',
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
    create: jest.fn().mockResolvedValue(mockRecord),
    findByPatient: jest.fn().mockResolvedValue(mockRecord),
    findById: jest.fn().mockResolvedValue(mockRecord),
    update: jest.fn().mockResolvedValue(mockRecord),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

async function buildController(serviceMock = buildMockService()) {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [EmergencyMedicalInfoController],
    providers: [{ provide: EmergencyMedicalInfoService, useValue: serviceMock }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return { controller: module.get(EmergencyMedicalInfoController), serviceMock };
}

describe('EmergencyMedicalInfoController', () => {
  it('is protected by JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', EmergencyMedicalInfoController);
    const guardNames = (guards ?? []).map((g: any) => g.name ?? g?.constructor?.name ?? String(g));
    expect(guardNames).toContain('JwtAuthGuard');
  });

  describe('POST /', () => {
    it('delegates to service.create and returns the record', async () => {
      const { controller, serviceMock } = await buildController();

      const dto = { patientId: 'patient-1', bloodType: BloodType.O_POS, allergies: ['penicillin'] };
      const result = await controller.create(dto as any);

      expect(serviceMock.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockRecord);
    });

    it('propagates ConflictException from service', async () => {
      const svc = buildMockService();
      svc.create.mockRejectedValue(new ConflictException('already exists'));
      const { controller } = await buildController(svc);

      await expect(controller.create({ patientId: 'patient-1' } as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('GET /patient/:patientId', () => {
    it('returns record for patient', async () => {
      const { controller, serviceMock } = await buildController();

      const result = await controller.findByPatient('patient-1');

      expect(serviceMock.findByPatient).toHaveBeenCalledWith('patient-1');
      expect(result).toBe(mockRecord);
    });

    it('propagates NotFoundException when record missing', async () => {
      const svc = buildMockService();
      svc.findByPatient.mockRejectedValue(new NotFoundException());
      const { controller } = await buildController(svc);

      await expect(controller.findByPatient('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /:id', () => {
    it('returns record by id', async () => {
      const { controller, serviceMock } = await buildController();

      const result = await controller.findById('emi-1');

      expect(serviceMock.findById).toHaveBeenCalledWith('emi-1');
      expect(result).toBe(mockRecord);
    });
  });

  describe('PUT /patient/:patientId', () => {
    it('delegates to service.update and returns updated record', async () => {
      const { controller, serviceMock } = await buildController();

      const dto = { bloodType: BloodType.A_POS };
      const result = await controller.update('patient-1', dto as any);

      expect(serviceMock.update).toHaveBeenCalledWith('patient-1', dto);
      expect(result).toBe(mockRecord);
    });
  });

  describe('DELETE /patient/:patientId', () => {
    it('delegates to service.remove', async () => {
      const { controller, serviceMock } = await buildController();

      await controller.remove('patient-1');

      expect(serviceMock.remove).toHaveBeenCalledWith('patient-1');
    });
  });
});
