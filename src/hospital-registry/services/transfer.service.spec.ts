import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TransferService } from './transfer.service';
import { PatientTransfer, TransferStatus } from '../entities/patient-transfer.entity';
import { HospitalRegistry } from '../entities/hospital-registry.entity';
import { MedicalRecordsService } from '../../medical-records/services/medical-records.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

describe('TransferService', () => {
  let service: TransferService;
  let medicalRecordsService: { shareWithHospital: jest.Mock };
  let accessControlService: { revokeAccessByPatient: jest.Mock };
  let mockManager: { save: jest.Mock };
  let mockTransferRepository: {
    findOne: jest.Mock;
    manager: { transaction: jest.Mock };
  };

  const pendingTransfer = () => ({
    id: 'transfer-1',
    patientId: 'patient-1',
    patientName: 'Jane Doe',
    fromHospitalId: 'hospital-from',
    toHospitalId: 'hospital-to',
    status: TransferStatus.PENDING,
    sharedRecordIds: ['record-1', 'record-2'],
    fromHospital: { email: 'from@hospital.test' },
    toHospital: { email: 'to@hospital.test' },
  });

  beforeEach(async () => {
    mockManager = {
      save: jest.fn((_entity, data) => Promise.resolve(data)),
    };

    mockTransferRepository = {
      findOne: jest.fn(),
      manager: {
        transaction: jest.fn((cb) => cb(mockManager)),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        { provide: getRepositoryToken(PatientTransfer), useValue: mockTransferRepository },
        { provide: getRepositoryToken(HospitalRegistry), useValue: { findOne: jest.fn() } },
        {
          provide: MedicalRecordsService,
          useValue: { shareWithHospital: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: AccessControlService,
          useValue: { revokeAccessByPatient: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: NotificationsService,
          useValue: { emitRecordUploaded: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(TransferService);
    medicalRecordsService = module.get(MedicalRecordsService);
    accessControlService = module.get(AccessControlService);
  });

  describe('acceptTransfer', () => {
    it('completes the transfer when sharing and revocation succeed', async () => {
      mockTransferRepository.findOne.mockResolvedValue(pendingTransfer());

      const result = await service.acceptTransfer('transfer-1', { acceptedBy: 'user-1' });

      expect(result.status).toBe(TransferStatus.COMPLETED);
      expect(medicalRecordsService.shareWithHospital).toHaveBeenCalledTimes(2);
      expect(accessControlService.revokeAccessByPatient).toHaveBeenCalledWith(
        'patient-1',
        'hospital-from',
        mockManager,
      );
      expect(mockTransferRepository.manager.transaction).toHaveBeenCalledTimes(1);
      expect(mockManager.save).toHaveBeenCalledTimes(1);
    });

    it('does not mark the transfer COMPLETED when record sharing fails', async () => {
      mockTransferRepository.findOne.mockResolvedValue(pendingTransfer());
      medicalRecordsService.shareWithHospital.mockRejectedValueOnce(new Error('IPFS unavailable'));

      await expect(
        service.acceptTransfer('transfer-1', { acceptedBy: 'user-1' }),
      ).rejects.toThrow('IPFS unavailable');

      expect(accessControlService.revokeAccessByPatient).not.toHaveBeenCalled();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('does not mark the transfer COMPLETED when access revocation fails', async () => {
      mockTransferRepository.findOne.mockResolvedValue(pendingTransfer());
      accessControlService.revokeAccessByPatient.mockRejectedValueOnce(
        new Error('access-control unavailable'),
      );

      await expect(
        service.acceptTransfer('transfer-1', { acceptedBy: 'user-1' }),
      ).rejects.toThrow('access-control unavailable');

      expect(mockManager.save).not.toHaveBeenCalled();
    });
  });
});
