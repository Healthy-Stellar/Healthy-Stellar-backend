import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { Drug } from '../entities/drug.entity';
import { Prescription } from '../entities/prescription.entity';
import { DrugInteractionService } from './drug-interaction.service';

const mockDrugRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
});

const mockPrescriptionRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
});

const mockDrugInteractionService = () => ({
  checkInteractions: jest.fn(),
});

describe('PharmacyService', () => {
  let service: PharmacyService;
  let drugRepo: ReturnType<typeof mockDrugRepo>;
  let prescriptionRepo: ReturnType<typeof mockPrescriptionRepo>;
  let drugInteractionService: ReturnType<typeof mockDrugInteractionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyService,
        { provide: getRepositoryToken(Drug), useFactory: mockDrugRepo },
        { provide: getRepositoryToken(Prescription), useFactory: mockPrescriptionRepo },
        { provide: DrugInteractionService, useFactory: mockDrugInteractionService },
      ],
    }).compile();

    service = module.get<PharmacyService>(PharmacyService);
    drugRepo = module.get(getRepositoryToken(Drug));
    prescriptionRepo = module.get(getRepositoryToken(Prescription));
    drugInteractionService = module.get(DrugInteractionService);
  });

  // ── addDrug ───────────────────────────────────────────────────────────────

  describe('addDrug', () => {
    it('creates and returns a drug', async () => {
      const dto = { name: 'Amoxicillin', ndc: '00093-1050-01', genericName: 'amoxicillin' };
      const drug = { id: 'uuid-1', ...dto };
      drugRepo.create.mockReturnValue(drug);
      drugRepo.save.mockResolvedValue(drug);

      const result = await service.addDrug(dto);

      expect(drugRepo.create).toHaveBeenCalledWith(dto);
      expect(drugRepo.save).toHaveBeenCalledWith(drug);
      expect(result).toEqual(drug);
    });

    it('wraps repository errors in BadRequestException', async () => {
      drugRepo.create.mockReturnValue({});
      drugRepo.save.mockRejectedValue(new Error('unique constraint violation'));

      await expect(service.addDrug({})).rejects.toThrow(BadRequestException);
    });
  });

  // ── checkInteractions ─────────────────────────────────────────────────────

  describe('checkInteractions', () => {
    it('returns safe=true when no interactions exist', async () => {
      drugInteractionService.checkInteractions.mockResolvedValue({
        hasInteractions: false,
        warnings: [],
        highestSeverity: 'none',
      });

      const result = await service.checkInteractions(['drug-1', 'drug-2'], 'patient-1');

      expect(result.safe).toBe(true);
      expect(result.interactions).toEqual([]);
      expect(result.highestSeverity).toBe('none');
    });

    it('returns safe=false with warnings when interactions are found', async () => {
      const warnings = [{ severity: 'major', mechanism: 'CYP3A4 inhibition' }];
      drugInteractionService.checkInteractions.mockResolvedValue({
        hasInteractions: true,
        warnings,
        highestSeverity: 'major',
      });

      const result = await service.checkInteractions(['drug-1', 'drug-2'], 'patient-1');

      expect(result.safe).toBe(false);
      expect(result.warnings).toEqual(warnings);
      expect(result.highestSeverity).toBe('major');
    });

    it('wraps interaction service errors in BadRequestException', async () => {
      drugInteractionService.checkInteractions.mockRejectedValue(new Error('OpenFDA timeout'));

      await expect(
        service.checkInteractions(['drug-1'], 'patient-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── fillPrescription ──────────────────────────────────────────────────────

  describe('fillPrescription', () => {
    const pendingPrescription = {
      id: 'rx-1',
      status: 'pending',
      pharmacistId: null as string | null,
      filledDate: null as Date | null,
    };

    it('fills a pending prescription and returns the updated record', async () => {
      const prescription = { ...pendingPrescription };
      prescriptionRepo.findOne.mockResolvedValue(prescription);
      prescriptionRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.fillPrescription('rx-1', 'pharm-1');

      expect(result.status).toBe('filled');
      expect(result.pharmacistId).toBe('pharm-1');
      expect(result.filledDate).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when prescription does not exist', async () => {
      prescriptionRepo.findOne.mockResolvedValue(null);

      await expect(service.fillPrescription('rx-missing', 'pharm-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when prescription is not in pending state', async () => {
      prescriptionRepo.findOne.mockResolvedValue({ ...pendingPrescription, status: 'filled' });

      await expect(service.fillPrescription('rx-1', 'pharm-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('wraps unexpected repository errors in BadRequestException', async () => {
      prescriptionRepo.findOne.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.fillPrescription('rx-1', 'pharm-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
