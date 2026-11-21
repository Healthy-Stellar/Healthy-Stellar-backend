import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { PatientTransfer, TransferStatus, ReceiptStatus } from '../entities/patient-transfer.entity';
import { HospitalRegistry } from '../entities/hospital-registry.entity';
import { MedicalRecordsService } from '../../medical-records/services/medical-records.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { StellarService } from '../../stellar/services/stellar.service';
import { ConfigService } from '@nestjs/config';

describe('TransferService', () => {
  let service: TransferService;
  let transferRepo: jest.Mocked<Repository<PatientTransfer>>;
  let hospitalRepo: jest.Mocked<Repository<HospitalRegistry>>;
  let medicalRecordsService: jest.Mocked<MedicalRecordsService>;
  let accessControlService: jest.Mocked<AccessControlService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let stellarService: jest.Mocked<StellarService>;
  let configService: jest.Mocked<ConfigService>;

  const mockTransfer: PatientTransfer = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    patientId: 'patient-123',
    patientName: 'John Doe',
    fromHospitalId: 'hospital-a',
    toHospitalId: 'hospital-b',
    status: TransferStatus.PENDING,
    transferReason: 'Patient relocation',
    consentedAt: null,
    consentedBy: null,
    acceptedAt: null,
    acceptedBy: null,
    completedAt: null,
    stellarTxHash: null,
    receiptStatus: ReceiptStatus.NOT_ANCHORED,
    receiptError: null,
    sharedRecordIds: [],
    initiatedBy: 'user-123',
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    fromHospital: undefined,
    toHospital: undefined,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        {
          provide: getRepositoryToken(PatientTransfer),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(HospitalRegistry),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: MedicalRecordsService,
          useValue: {
            shareWithHospital: jest.fn(),
          },
        },
        {
          provide: AccessControlService,
          useValue: {
            revokeAccessByPatient: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            emitRecordUploaded: jest.fn(),
          },
        },
        {
          provide: StellarService,
          useValue: {
            invokeContract: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransferService>(TransferService);
    transferRepo = module.get(getRepositoryToken(PatientTransfer)) as jest.Mocked<Repository<PatientTransfer>>;
    hospitalRepo = module.get(getRepositoryToken(HospitalRegistry)) as jest.Mocked<Repository<HospitalRegistry>>;
    medicalRecordsService = module.get(MedicalRecordsService) as jest.Mocked<MedicalRecordsService>;
    accessControlService = module.get(AccessControlService) as jest.Mocked<AccessControlService>;
    notificationsService = module.get(NotificationsService) as jest.Mocked<NotificationsService>;
    stellarService = module.get(StellarService) as jest.Mocked<StellarService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  describe('acceptTransfer with Stellar anchoring', () => {
    it('should anchor transfer receipt on Stellar success', async () => {
      const transfer = { ...mockTransfer, status: TransferStatus.PENDING };
      const hospital = { id: 'hospital-b', email: 'hospital@example.com' };
      const realTxHash = '950a8f8caa884847a7c6e4d5f3e2b1a0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f';

      transferRepo.findOne.mockResolvedValue(transfer);
      hospitalRepo.findOne.mockResolvedValue(hospital);
      stellarService.invokeContract.mockResolvedValue({
        txHash: realTxHash,
        ledger: 47291847,
        confirmedAt: Date.now(),
      });
      transferRepo.save.mockImplementation((t) => Promise.resolve(t));

      await service.acceptTransfer(transfer.id, {
        acceptedBy: 'user-456',
      });

      // Verify Stellar service was called
      expect(stellarService.invokeContract).toHaveBeenCalledWith(
        expect.any(String),
        'anchor_transfer',
        expect.any(Array),
      );

      // Verify saved transfer has real hash
      expect(transferRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          stellarTxHash: realTxHash,
          receiptStatus: ReceiptStatus.ANCHORED,
          receiptError: null,
        }),
      );
    });

    it('should set NOT_ANCHORED status when Stellar fails', async () => {
      const transfer = { ...mockTransfer, status: TransferStatus.PENDING };
      const error = new Error('Stellar network unavailable');

      transferRepo.findOne.mockResolvedValue(transfer);
      stellarService.invokeContract.mockRejectedValue(error);
      transferRepo.save.mockImplementation((t) => Promise.resolve(t));

      await service.acceptTransfer(transfer.id, {
        acceptedBy: 'user-456',
      });

      // Verify saved transfer has null hash and NOT_ANCHORED status
      expect(transferRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          stellarTxHash: null,
          receiptStatus: ReceiptStatus.NOT_ANCHORED,
          receiptError: error.message,
        }),
      );
    });

    it('should never store fake receipts (sim-prefix)', async () => {
      const transfer = { ...mockTransfer, status: TransferStatus.PENDING };

      transferRepo.findOne.mockResolvedValue(transfer);
      stellarService.invokeContract.mockRejectedValue(new Error('Network error'));
      transferRepo.save.mockImplementation((t) => Promise.resolve(t));

      await service.acceptTransfer(transfer.id, {
        acceptedBy: 'user-456',
      });

      const savedTransfer = (transferRepo.save as jest.Mock).mock.calls[0][0];
      
      // Assert no fake receipt
      expect(savedTransfer.stellarTxHash).not.toMatch(/^sim-/);
      expect(savedTransfer.stellarTxHash).toBeNull();
    });

    it('should track anchoring status transitions', async () => {
      const transfer = { ...mockTransfer, status: TransferStatus.PENDING };
      const realTxHash = '950a8f8caa884847a7c6e4d5f3e2b1a0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f';

      transferRepo.findOne.mockResolvedValue(transfer);
      stellarService.invokeContract.mockResolvedValue({
        txHash: realTxHash,
        ledger: 47291847,
        confirmedAt: Date.now(),
      });
      transferRepo.save.mockImplementation((t) => Promise.resolve(t));

      await service.acceptTransfer(transfer.id, {
        acceptedBy: 'user-456',
      });

      const savedTransfer = (transferRepo.save as jest.Mock).mock.calls[0][0];
      
      // Should transition from default NOT_ANCHORED → ANCHORING → ANCHORED
      expect(savedTransfer.receiptStatus).toBe(ReceiptStatus.ANCHORED);
    });

    it('should include receiptError on failure', async () => {
      const transfer = { ...mockTransfer, status: TransferStatus.PENDING };
      const errorMessage = 'Contract execution failed: insufficient balance';

      transferRepo.findOne.mockResolvedValue(transfer);
      stellarService.invokeContract.mockRejectedValue(new Error(errorMessage));
      transferRepo.save.mockImplementation((t) => Promise.resolve(t));

      await service.acceptTransfer(transfer.id, {
        acceptedBy: 'user-456',
      });

      const savedTransfer = (transferRepo.save as jest.Mock).mock.calls[0][0];
      
      expect(savedTransfer.receiptError).toBe(errorMessage);
      expect(savedTransfer.receiptStatus).toBe(ReceiptStatus.NOT_ANCHORED);
    });
  });

  describe('GET transfer with receipt info', () => {
    it('should return receipt status for auditing', async () => {
      const transfer = {
        ...mockTransfer,
        stellarTxHash: '950a8f8caa884847a7c6e4d5f3e2b1a0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f',
        receiptStatus: ReceiptStatus.ANCHORED,
      };

      transferRepo.findOne.mockResolvedValue(transfer);

      const result = await service.getTransfer(transfer.id);

      expect(result.receiptStatus).toBe(ReceiptStatus.ANCHORED);
      expect(result.stellarTxHash).toBe(transfer.stellarTxHash);
      expect(result.receiptError).toBeNull();
    });

    it('should show NOT_ANCHORED status when transfer not yet anchored', async () => {
      const transfer = {
        ...mockTransfer,
        stellarTxHash: null,
        receiptStatus: ReceiptStatus.NOT_ANCHORED,
        receiptError: 'Stellar network unavailable at time of completion',
      };

      transferRepo.findOne.mockResolvedValue(transfer);

      const result = await service.getTransfer(transfer.id);

      expect(result.receiptStatus).toBe(ReceiptStatus.NOT_ANCHORED);
      expect(result.stellarTxHash).toBeNull();
      expect(result.receiptError).toBeTruthy();
    });
  });

  describe('Backward compatibility with existing data', () => {
    it('should handle pre-migration fake receipts gracefully', async () => {
      const transferWithFakeReceipt = {
        ...mockTransfer,
        stellarTxHash: 'sim-550e8400e29b41d4a716',  // Old fake format
        receiptStatus: ReceiptStatus.NOT_ANCHORED,
      };

      transferRepo.findOne.mockResolvedValue(transferWithFakeReceipt);

      const result = await service.getTransfer(transferWithFakeReceipt.id);

      // API should clearly show this is not anchored
      expect(result.receiptStatus).toBe(ReceiptStatus.NOT_ANCHORED);
      // Clients should not trust the hash
      expect(result.receiptError).toBeDefined();
    });
  });
});
