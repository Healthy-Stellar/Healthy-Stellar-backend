import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EprescribingService } from './eprescribing.service';
import { ExternalPharmacy } from '../entities/external-pharmacy.entity';
import {
  EprescriptionTransmission,
  TransmissionStatus,
} from '../entities/eprescription-transmission.entity';
import { Prescription } from '../entities/prescription.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';

const makeRepo = (overrides: Partial<any> = {}) => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((x) => x),
  save: jest.fn().mockImplementation((x) => Promise.resolve({ id: 'tx-1', ...x })),
  ...overrides,
});

const VERIFIED_PRESCRIPTION = {
  id: 'rx-1',
  patientId: 'patient-1',
  patientName: 'Jane Doe',
  drugId: 'drug-1',
  drugName: 'Amoxicillin 500mg',
  dosage: '500mg',
  quantity: 30,
  refillsAllowed: 2,
  instructions: 'Take one capsule three times daily',
  status: 'verified',
  prescriberId: 'provider-1',
  patientAllergies: [],
};

const ACTIVE_PHARMACY = {
  id: 'pharm-1',
  name: 'CVS Pharmacy',
  ncpdpId: '1234567',
  npi: '9876543210',
  isActive: true,
  supportsElectronicPrescribing: true,
  address: { street: '100 Main St', city: 'Boston', state: 'MA', zip: '02101', country: 'US' },
  phone: '617-555-0100',
  fax: '617-555-0101',
};

describe('EprescribingService', () => {
  let service: EprescribingService;
  let prescriptionRepo: ReturnType<typeof makeRepo>;
  let pharmacyRepo: ReturnType<typeof makeRepo>;
  let transmissionRepo: ReturnType<typeof makeRepo>;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    prescriptionRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(VERIFIED_PRESCRIPTION) });
    pharmacyRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(ACTIVE_PHARMACY) });
    transmissionRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EprescribingService,
        { provide: getRepositoryToken(ExternalPharmacy), useValue: pharmacyRepo },
        { provide: getRepositoryToken(EprescriptionTransmission), useValue: transmissionRepo },
        { provide: getRepositoryToken(Prescription), useValue: prescriptionRepo },
        {
          provide: NotificationsService,
          useValue: { emitRecordAmended: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<EprescribingService>(EprescribingService);
    notificationsService = module.get(NotificationsService);
  });

  describe('transmitPrescription', () => {
    it('builds an NCPDP NewRx payload and records an ACCEPTED transmission', async () => {
      const result = await service.transmitPrescription(
        { prescriptionId: 'rx-1', externalPharmacyId: 'pharm-1' },
        'user-1',
      );

      expect(transmissionRepo.save).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(TransmissionStatus.ACCEPTED);
      expect(result.ncpdpNewRxPayload).toMatchObject({
        messageType: 'NewRx',
        drug: expect.objectContaining({ name: 'Amoxicillin 500mg' }),
        pharmacy: expect.objectContaining({ ncpdpId: '1234567' }),
      });
    });

    it('throws BadRequestException for unverified prescriptions', async () => {
      prescriptionRepo.findOne.mockResolvedValue({ ...VERIFIED_PRESCRIPTION, status: 'pending' });

      await expect(
        service.transmitPrescription(
          { prescriptionId: 'rx-1', externalPharmacyId: 'pharm-1' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when pharmacy does not exist', async () => {
      pharmacyRepo.findOne.mockResolvedValue(null);

      await expect(
        service.transmitPrescription(
          { prescriptionId: 'rx-1', externalPharmacyId: 'unknown' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('retryTransmission — rejected-transmission retry path', () => {
    const rejectedTransmission = {
      id: 'tx-1',
      prescriptionId: 'rx-1',
      externalPharmacyId: 'pharm-1',
      status: TransmissionStatus.REJECTED,
      retryCount: 0,
      ncpdpNewRxPayload: {},
    };

    it('retries a rejected transmission and records ACCEPTED on success', async () => {
      transmissionRepo.findOne.mockResolvedValue({ ...rejectedTransmission });

      const result = await service.retryTransmission('tx-1', 'user-1');

      expect(result.status).toBe(TransmissionStatus.ACCEPTED);
      expect(result.retryCount).toBe(1);
    });

    it('throws BadRequestException when max retries are exhausted', async () => {
      transmissionRepo.findOne.mockResolvedValue({
        ...rejectedTransmission,
        retryCount: 3,
      });

      await expect(service.retryTransmission('tx-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when transmission is already accepted', async () => {
      transmissionRepo.findOne.mockResolvedValue({
        ...rejectedTransmission,
        status: TransmissionStatus.ACCEPTED,
      });

      await expect(service.retryTransmission('tx-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
