import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { LaboratoryService } from './laboratory.service';
import { LabOrder } from '../entities/lab-order.entity';
import { Specimen } from '../entities/specimen.entity';
import { LabResult } from '../entities/lab-result.entity';

const mockOrderRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
});

const mockSpecimenRepo = () => ({
  findOne: jest.fn(),
});

const mockResultRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

describe('LaboratoryService', () => {
  let service: LaboratoryService;
  let orderRepo: ReturnType<typeof mockOrderRepo>;
  let specimenRepo: ReturnType<typeof mockSpecimenRepo>;
  let resultRepo: ReturnType<typeof mockResultRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaboratoryService,
        { provide: getRepositoryToken(LabOrder), useFactory: mockOrderRepo },
        { provide: getRepositoryToken(Specimen), useFactory: mockSpecimenRepo },
        { provide: getRepositoryToken(LabResult), useFactory: mockResultRepo },
      ],
    }).compile();

    service = module.get<LaboratoryService>(LaboratoryService);
    orderRepo = module.get(getRepositoryToken(LabOrder));
    specimenRepo = module.get(getRepositoryToken(Specimen));
    resultRepo = module.get(getRepositoryToken(LabResult));
  });

  // ── createOrder ───────────────────────────────────────────────────────────

  describe('createOrder', () => {
    it('generates an order number and saves the order', async () => {
      orderRepo.findOne.mockResolvedValue(null); // no prior orders
      const expectedOrder = { id: 'order-1', orderNumber: `LAB-${new Date().getFullYear()}-0001` };
      orderRepo.create.mockReturnValue(expectedOrder);
      orderRepo.save.mockResolvedValue(expectedOrder);

      const result = await service.createOrder({ patientId: 'p-1', providerId: 'dr-1' });

      expect(orderRepo.save).toHaveBeenCalled();
      expect(result.orderNumber).toMatch(/^LAB-\d{4}-\d{4}$/);
    });

    it('increments sequence from latest order number', async () => {
      const year = new Date().getFullYear();
      orderRepo.findOne.mockResolvedValue({ orderNumber: `LAB-${year}-0005` });
      const expectedOrder = { id: 'order-6', orderNumber: `LAB-${year}-0006` };
      orderRepo.create.mockReturnValue(expectedOrder);
      orderRepo.save.mockResolvedValue(expectedOrder);

      const result = await service.createOrder({ patientId: 'p-1', providerId: 'dr-1' });

      expect(result.orderNumber).toBe(`LAB-${year}-0006`);
    });

    it('falls back to sequence 1 when latest orderNumber has no parseable suffix', async () => {
      orderRepo.findOne.mockResolvedValue({ orderNumber: 'LEGACY-001' });
      const year = new Date().getFullYear();
      const expectedOrder = { id: 'order-1', orderNumber: `LAB-${year}-0001` };
      orderRepo.create.mockReturnValue(expectedOrder);
      orderRepo.save.mockResolvedValue(expectedOrder);

      const result = await service.createOrder({ patientId: 'p-1', providerId: 'dr-1' });

      expect(result.orderNumber).toBe(`LAB-${year}-0001`);
    });
  });

  // ── trackSpecimen ─────────────────────────────────────────────────────────

  describe('trackSpecimen', () => {
    it('returns a specimen by ID', async () => {
      const specimen = { id: 'spec-1', specimenType: 'blood', orderId: 'order-1' };
      specimenRepo.findOne.mockResolvedValue(specimen);

      const result = await service.trackSpecimen('spec-1');

      expect(specimenRepo.findOne).toHaveBeenCalledWith({ where: { id: 'spec-1' } });
      expect(result).toEqual(specimen);
    });

    it('throws NotFoundException when specimen does not exist', async () => {
      specimenRepo.findOne.mockResolvedValue(null);

      await expect(service.trackSpecimen('spec-missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── recordResult ──────────────────────────────────────────────────────────

  describe('recordResult', () => {
    it('saves and returns a lab result when order exists', async () => {
      const order = { id: 'order-1' };
      orderRepo.findOne.mockResolvedValue(order);
      const result = { id: 'result-1', orderId: 'order-1', testCode: 'CBC', result: 'Normal' };
      resultRepo.create.mockReturnValue(result);
      resultRepo.save.mockResolvedValue(result);

      const saved = await service.recordResult({ orderId: 'order-1', testCode: 'CBC', result: 'Normal' });

      expect(orderRepo.findOne).toHaveBeenCalledWith({ where: { id: 'order-1' } });
      expect(resultRepo.save).toHaveBeenCalled();
      expect(saved).toEqual(result);
    });

    it('saves result without order validation when orderId is absent', async () => {
      const result = { id: 'result-2', testCode: 'BMP', result: 'Abnormal' };
      resultRepo.create.mockReturnValue(result);
      resultRepo.save.mockResolvedValue(result);

      const saved = await service.recordResult({ testCode: 'BMP', result: 'Abnormal' });

      expect(orderRepo.findOne).not.toHaveBeenCalled();
      expect(saved).toEqual(result);
    });

    it('throws NotFoundException when referenced order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.recordResult({ orderId: 'order-missing', testCode: 'CBC' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
