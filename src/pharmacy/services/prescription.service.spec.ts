import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionItem } from '../entities/prescription-item.entity';
import { PrescriptionDispenseRecord } from '../entities/prescription-dispense-record.entity';
import { Drug } from '../entities/drug.entity';
import { SafetyAlertService } from './safety-alert.service';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { ControlledSubstanceService } from './controlled-substance.service';
import { DrugInteractionService } from './drug-interaction.service';
import { MedicalStaffService } from '../../medical-staff/medical-staff.service';
import { LicenseStatus } from '../../medical-staff/entities/doctor.entity';
import { QUEUE_NAMES } from '../../queues/queue.constants';

const mockPrescriptionRepo = () => ({
  create: jest.fn((data) => data),
  save: jest.fn((entity) => Promise.resolve({ id: 'rx-1', ...entity })),
  find: jest.fn(),
  findOne: jest.fn(),
});

const mockPrescriptionItemRepo = () => ({
  create: jest.fn((data) => data),
  save: jest.fn((entities) => Promise.resolve(entities)),
  find: jest.fn(),
});

const mockDispenseRecordRepo = () => ({
  create: jest.fn((data) => data),
  save: jest.fn((entity) => Promise.resolve({ id: 'dispense-1', ...entity })),
  find: jest.fn(),
});

const mockDrugRepo = () => ({
  findOne: jest.fn(),
});

const mockSafetyAlertService = () => ({
  generateAlertsForPrescription: jest.fn().mockResolvedValue([]),
  getAlertsByPrescription: jest.fn().mockResolvedValue([]),
});

const mockInventoryService = () => ({
  getTotalQuantity: jest.fn(),
  deductInventory: jest.fn().mockResolvedValue(undefined),
  getInventoryByDrug: jest.fn().mockResolvedValue([]),
});

const mockControlledSubstanceService = () => ({
  logDispensing: jest.fn().mockResolvedValue({}),
});

const mockDrugInteractionService = () => ({
  checkInteractions: jest.fn(),
});

const mockMedicalStaffService = () => ({
  findDoctorById: jest.fn(),
});

describe('PrescriptionService', () => {
  let service: PrescriptionService;
  let prescriptionRepo: ReturnType<typeof mockPrescriptionRepo>;
  let prescriptionItemRepo: ReturnType<typeof mockPrescriptionItemRepo>;
  let dispenseRecordRepo: ReturnType<typeof mockDispenseRecordRepo>;
  let drugRepo: ReturnType<typeof mockDrugRepo>;
  let inventoryService: ReturnType<typeof mockInventoryService>;
  let drugInteractionService: ReturnType<typeof mockDrugInteractionService>;
  let medicalStaffService: ReturnType<typeof mockMedicalStaffService>;
  let controlledSubstanceService: ReturnType<typeof mockControlledSubstanceService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionService,
        { provide: getRepositoryToken(Prescription), useFactory: mockPrescriptionRepo },
        { provide: getRepositoryToken(PrescriptionItem), useFactory: mockPrescriptionItemRepo },
        {
          provide: getRepositoryToken(PrescriptionDispenseRecord),
          useFactory: mockDispenseRecordRepo,
        },
        { provide: getRepositoryToken(Drug), useFactory: mockDrugRepo },
        { provide: SafetyAlertService, useFactory: mockSafetyAlertService },
        { provide: PharmacyInventoryService, useFactory: mockInventoryService },
        { provide: ControlledSubstanceService, useFactory: mockControlledSubstanceService },
        { provide: DrugInteractionService, useFactory: mockDrugInteractionService },
        { provide: MedicalStaffService, useFactory: mockMedicalStaffService },
        { provide: getQueueToken(QUEUE_NAMES.PHARMACY_REORDER_ALERTS), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<PrescriptionService>(PrescriptionService);
    prescriptionRepo = module.get(getRepositoryToken(Prescription));
    prescriptionItemRepo = module.get(getRepositoryToken(PrescriptionItem));
    dispenseRecordRepo = module.get(getRepositoryToken(PrescriptionDispenseRecord));
    drugRepo = module.get(getRepositoryToken(Drug));
    inventoryService = module.get(PharmacyInventoryService);
    drugInteractionService = module.get(DrugInteractionService);
    medicalStaffService = module.get(MedicalStaffService);
    controlledSubstanceService = module.get(ControlledSubstanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── create() — prescriber license validation ───────────────────────────────

  describe('create — prescriber license validation', () => {
    const createDto: any = {
      prescriptionNumber: 'RX-1001',
      patientId: 'patient-1',
      patientName: 'Jane Doe',
      prescriberId: 'doctor-1',
      prescriptionDate: '2026-01-01',
      refillsAllowed: 2,
      items: [{ drugId: 'drug-1', quantityPrescribed: 30, dosageInstructions: 'Once daily' }],
    };

    it('rejects creation when the prescribing doctor has no active license', async () => {
      medicalStaffService.findDoctorById.mockResolvedValue({
        id: 'doctor-1',
        licenseStatus: LicenseStatus.EXPIRED,
      });

      await expect(service.create(createDto)).rejects.toThrow(ForbiddenException);
      expect(drugInteractionService.checkInteractions).not.toHaveBeenCalled();
    });

    it('rejects creation when the prescribing doctor cannot be found', async () => {
      medicalStaffService.findDoctorById.mockRejectedValue(new Error('Doctor not found'));

      await expect(service.create(createDto)).rejects.toThrow(ForbiddenException);
    });

    it('creates the prescription when the doctor has an active license and no severe interactions', async () => {
      medicalStaffService.findDoctorById.mockResolvedValue({
        id: 'doctor-1',
        licenseStatus: LicenseStatus.ACTIVE,
      });
      drugInteractionService.checkInteractions.mockResolvedValue({
        hasInteractions: false,
        warnings: [],
        highestSeverity: 'none',
      });
      prescriptionRepo.findOne.mockResolvedValue({
        id: 'rx-1',
        items: [],
        dispenseRecords: [],
      });

      const result = await service.create(createDto);

      expect(medicalStaffService.findDoctorById).toHaveBeenCalledWith('doctor-1');
      expect(prescriptionRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  // ── dispensePrescription() ─────────────────────────────────────────────────

  describe('dispensePrescription', () => {
    const basePrescription = () => ({
      id: 'rx-1',
      patientId: 'patient-1',
      drugId: 'drug-1',
      quantity: 30,
      status: 'verified',
      refillsRemaining: 2,
      items: [],
      dispenseRecords: [],
    });

    beforeEach(() => {
      // findOne() is called internally; back it with findOne mock returning the prescription.
      prescriptionRepo.findOne.mockImplementation(() => Promise.resolve(basePrescription()));
      prescriptionRepo.find.mockResolvedValue([]); // no other active prescriptions for the patient
      drugRepo.findOne.mockResolvedValue({ id: 'drug-1', controlledSubstanceSchedule: null });
    });

    it('dispenses successfully, deducts inventory, and records a dispense transaction', async () => {
      drugInteractionService.checkInteractions.mockResolvedValue({
        hasInteractions: false,
        warnings: [],
        highestSeverity: 'none',
      });
      inventoryService.getTotalQuantity.mockResolvedValue(100);

      const result = await service.dispensePrescription('rx-1', { pharmacistId: 'pharm-1' });

      expect(inventoryService.deductInventory).toHaveBeenCalledWith('drug-1', 30);
      expect(dispenseRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          prescriptionId: 'rx-1',
          drugId: 'drug-1',
          quantityDispensed: 30,
          pharmacistId: 'pharm-1',
          interactionSeverity: 'none',
        }),
      );
      expect(dispenseRecordRepo.save).toHaveBeenCalled();
      expect(result.dispenseRecord).toBeDefined();
      expect(result.interactionCheck.highestSeverity).toBe('none');
    });

    it('deducts the requested quantity (not the full prescription quantity) when provided', async () => {
      drugInteractionService.checkInteractions.mockResolvedValue({
        hasInteractions: false,
        warnings: [],
        highestSeverity: 'none',
      });
      inventoryService.getTotalQuantity.mockResolvedValue(100);

      await service.dispensePrescription('rx-1', { pharmacistId: 'pharm-1', quantity: 10 });

      expect(inventoryService.deductInventory).toHaveBeenCalledWith('drug-1', 10);
    });

    it('throws BadRequestException when inventory is insufficient and does not deduct', async () => {
      drugInteractionService.checkInteractions.mockResolvedValue({
        hasInteractions: false,
        warnings: [],
        highestSeverity: 'none',
      });
      inventoryService.getTotalQuantity.mockResolvedValue(5); // less than the prescribed 30

      await expect(
        service.dispensePrescription('rx-1', { pharmacistId: 'pharm-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(inventoryService.deductInventory).not.toHaveBeenCalled();
      expect(dispenseRecordRepo.save).not.toHaveBeenCalled();
    });

    it('allows dispensing with a non-blocking warning on a moderate interaction', async () => {
      const interactionCheck = {
        hasInteractions: true,
        warnings: [{ severity: 'moderate', drug1Name: 'A', drug2Name: 'B' }],
        highestSeverity: 'moderate',
      };
      drugInteractionService.checkInteractions.mockResolvedValue(interactionCheck);
      inventoryService.getTotalQuantity.mockResolvedValue(100);

      const result = await service.dispensePrescription('rx-1', { pharmacistId: 'pharm-1' });

      expect(inventoryService.deductInventory).toHaveBeenCalled();
      expect(result.interactionCheck.highestSeverity).toBe('moderate');
      expect(dispenseRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ interactionSeverity: 'moderate' }),
      );
    });

    it('blocks dispensing on a major interaction and does not touch inventory', async () => {
      drugInteractionService.checkInteractions.mockResolvedValue({
        hasInteractions: true,
        warnings: [{ severity: 'major', drug1Name: 'A', drug2Name: 'B' }],
        highestSeverity: 'major',
      });

      await expect(
        service.dispensePrescription('rx-1', { pharmacistId: 'pharm-1' }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(inventoryService.deductInventory).not.toHaveBeenCalled();
      expect(dispenseRecordRepo.save).not.toHaveBeenCalled();
    });

    it('blocks dispensing on a contraindicated interaction', async () => {
      drugInteractionService.checkInteractions.mockResolvedValue({
        hasInteractions: true,
        warnings: [{ severity: 'contraindicated', drug1Name: 'A', drug2Name: 'B' }],
        highestSeverity: 'contraindicated',
      });

      await expect(
        service.dispensePrescription('rx-1', { pharmacistId: 'pharm-1' }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(inventoryService.deductInventory).not.toHaveBeenCalled();
    });

    it('rejects dispensing a prescription that is already dispensed', async () => {
      prescriptionRepo.findOne.mockResolvedValue({ ...basePrescription(), status: 'dispensed' });

      await expect(
        service.dispensePrescription('rx-1', { pharmacistId: 'pharm-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(drugInteractionService.checkInteractions).not.toHaveBeenCalled();
    });

    it('rejects dispensing a cancelled prescription', async () => {
      prescriptionRepo.findOne.mockResolvedValue({ ...basePrescription(), status: 'cancelled' });

      await expect(
        service.dispensePrescription('rx-1', { pharmacistId: 'pharm-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('logs a controlled-substance dispensing transaction for scheduled drugs', async () => {
      drugInteractionService.checkInteractions.mockResolvedValue({
        hasInteractions: false,
        warnings: [],
        highestSeverity: 'none',
      });
      inventoryService.getTotalQuantity.mockResolvedValue(100);
      drugRepo.findOne.mockResolvedValue({ id: 'drug-1', controlledSubstanceSchedule: 'CII' });

      await service.dispensePrescription('rx-1', { pharmacistId: 'pharm-1' });

      expect(controlledSubstanceService.logDispensing).toHaveBeenCalled();
    });
  });
});
