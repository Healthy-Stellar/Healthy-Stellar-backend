import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PrescriptionValidationService } from './prescription-validation.service';
import { PdmpService } from './pdmp.service';
import { Prescription } from '../entities/prescription.entity';
import { Drug } from '../entities/drug.entity';
import { SafetyAlert } from '../entities/safety-alert.entity';
import { ControlledSubstanceSchedule } from '../entities/drug.entity';
import { PrescriptionValidationErrorCode } from '../errors/prescription-validation.error';

// ── Helpers ──────────────────────────────────────────────────────────────────

const basePrescription = (overrides: Partial<Prescription> = {}): Prescription =>
  ({
    id: 'rx-1',
    patientId: 'patient-1',
    providerId: 'provider-1',
    refills: 0,
    prescribedDate: new Date(),
    controlledSubstanceSchedule: null,
    items: [],
    ...overrides,
  } as any);

const basePatientFactors = () => ({
  age: 40,
  allergies: [],
  medicalConditions: [],
});

// ── Setup ─────────────────────────────────────────────────────────────────────

describe('PrescriptionValidationService – DEA / Schedule II / PDMP', () => {
  let service: PrescriptionValidationService;
  let pdmpService: jest.Mocked<PdmpService>;
  let prescriptionRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    prescriptionRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionValidationService,
        {
          provide: getRepositoryToken(Prescription),
          useValue: prescriptionRepo,
        },
        {
          provide: getRepositoryToken(Drug),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(SafetyAlert),
          useValue: { find: jest.fn() },
        },
        {
          provide: PdmpService,
          useValue: { getPatientHistory: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get(PrescriptionValidationService);
    pdmpService = module.get(PdmpService);
  });

  // ── DEA number ─────────────────────────────────────────────────────────────

  it('rejects a Schedule II prescription when no DEA number is provided', async () => {
    prescriptionRepo.findOne.mockResolvedValue(
      basePrescription({ controlledSubstanceSchedule: ControlledSubstanceSchedule.SCHEDULE_II }),
    );

    const result = await service.validatePrescription('rx-1', basePatientFactors());

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === PrescriptionValidationErrorCode.DEA_NUMBER_REQUIRED)).toBe(true);
  });

  it('passes DEA check when a DEA number is supplied for a Schedule II prescription', async () => {
    prescriptionRepo.findOne.mockResolvedValue(
      basePrescription({ controlledSubstanceSchedule: ControlledSubstanceSchedule.SCHEDULE_II }),
    );

    const result = await service.validatePrescription('rx-1', basePatientFactors(), 'AB1234563');

    expect(result.errors.some((e) => e.code === PrescriptionValidationErrorCode.DEA_NUMBER_REQUIRED)).toBe(false);
  });

  // ── No refills on CII ──────────────────────────────────────────────────────

  it('rejects a Schedule II prescription that has refills > 0', async () => {
    prescriptionRepo.findOne.mockResolvedValue(
      basePrescription({
        controlledSubstanceSchedule: ControlledSubstanceSchedule.SCHEDULE_II,
        refills: 2,
      }),
    );

    const result = await service.validatePrescription('rx-1', basePatientFactors(), 'AB1234563');

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === PrescriptionValidationErrorCode.SCHEDULE_II_NO_REFILLS)).toBe(true);
  });

  it('accepts a Schedule II prescription with 0 refills', async () => {
    prescriptionRepo.findOne.mockResolvedValue(
      basePrescription({
        controlledSubstanceSchedule: ControlledSubstanceSchedule.SCHEDULE_II,
        refills: 0,
      }),
    );

    const result = await service.validatePrescription('rx-1', basePatientFactors(), 'AB1234563');

    expect(result.errors.some((e) => e.code === PrescriptionValidationErrorCode.SCHEDULE_II_NO_REFILLS)).toBe(false);
  });

  // ── Fill age limit ─────────────────────────────────────────────────────────

  it('rejects a Schedule II prescription older than 90 days', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 91);

    prescriptionRepo.findOne.mockResolvedValue(
      basePrescription({
        controlledSubstanceSchedule: ControlledSubstanceSchedule.SCHEDULE_II,
        prescribedDate: oldDate,
        refills: 0,
      }),
    );

    const result = await service.validatePrescription('rx-1', basePatientFactors(), 'AB1234563');

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === PrescriptionValidationErrorCode.SCHEDULE_II_EXPIRED)).toBe(true);
  });

  it('accepts a Schedule II prescription written today', async () => {
    prescriptionRepo.findOne.mockResolvedValue(
      basePrescription({
        controlledSubstanceSchedule: ControlledSubstanceSchedule.SCHEDULE_II,
        prescribedDate: new Date(),
        refills: 0,
      }),
    );

    const result = await service.validatePrescription('rx-1', basePatientFactors(), 'AB1234563');

    expect(result.errors.some((e) => e.code === PrescriptionValidationErrorCode.SCHEDULE_II_EXPIRED)).toBe(false);
  });

  // ── PDMP ───────────────────────────────────────────────────────────────────

  it('flags a PDMP hit when patient has 3+ prescribers in 90 days', async () => {
    prescriptionRepo.findOne.mockResolvedValue(basePrescription());
    pdmpService.getPatientHistory.mockResolvedValue({
      patientId: 'patient-1',
      records: [],
      multiplePrescriberCount: 4,
      multiplePharmacyCount: 1,
    });

    const result = await service.validatePrescription('rx-1', basePatientFactors());

    expect(result.errors.some((e) => e.code === PrescriptionValidationErrorCode.PDMP_FLAG)).toBe(true);
  });

  it('does not flag PDMP when history is clean', async () => {
    prescriptionRepo.findOne.mockResolvedValue(basePrescription());
    pdmpService.getPatientHistory.mockResolvedValue({
      patientId: 'patient-1',
      records: [],
      multiplePrescriberCount: 1,
      multiplePharmacyCount: 1,
    });

    const result = await service.validatePrescription('rx-1', basePatientFactors());

    expect(result.errors.some((e) => e.code === PrescriptionValidationErrorCode.PDMP_FLAG)).toBe(false);
  });

  it('skips PDMP check gracefully when service returns null', async () => {
    prescriptionRepo.findOne.mockResolvedValue(basePrescription());
    pdmpService.getPatientHistory.mockResolvedValue(null);

    const result = await service.validatePrescription('rx-1', basePatientFactors());

    expect(result.errors.some((e) => e.code === PrescriptionValidationErrorCode.PDMP_FLAG)).toBe(false);
  });

  // ── Non-controlled prescriptions unaffected ────────────────────────────────

  it('does not apply DEA/schedule rules to non-controlled prescriptions', async () => {
    prescriptionRepo.findOne.mockResolvedValue(
      basePrescription({ controlledSubstanceSchedule: null }),
    );

    const result = await service.validatePrescription('rx-1', basePatientFactors());

    expect(result.errors).toHaveLength(0);
  });
});
