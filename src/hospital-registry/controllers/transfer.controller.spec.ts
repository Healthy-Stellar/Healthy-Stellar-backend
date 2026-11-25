import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TransferController } from './transfer.controller';
import { TransferService } from '../services/transfer.service';
import { PatientTransfer, TransferStatus } from '../entities/patient-transfer.entity';
import { HospitalRegistry } from '../entities/hospital-registry.entity';
import { MedicalRecordsService } from '../../medical-records/services/medical-records.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { StellarService } from '../../stellar/services/stellar.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

const FROM = 'hospital-from';
const TO = 'hospital-to';
const OTHER = 'hospital-other';

// Raw JWT payload as set by JwtAuthGuard: tenant is `organizationId`, no `hospitalId`.
const principal = (organizationId: string, userId = `user-${organizationId}`) => ({
  user: { userId, role: 'physician', organizationId },
});

const pendingTransfer = () => ({
  id: 'transfer-1',
  patientId: 'patient-1',
  patientName: 'Jane Doe',
  fromHospitalId: FROM,
  toHospitalId: TO,
  status: TransferStatus.PENDING,
  sharedRecordIds: [],
  fromHospital: { email: null },
  toHospital: { email: null },
});

describe('TransferController', () => {
  let controller: TransferController;
  let transferRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    manager: { transaction: jest.Mock };
  };

  beforeEach(async () => {
    const manager = { save: jest.fn((_e, data) => Promise.resolve(data)) };
    transferRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 'transfer-1', ...data })),
      manager: { transaction: jest.fn((cb) => cb(manager)) },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransferController],
      providers: [
        TransferService,
        { provide: getRepositoryToken(PatientTransfer), useValue: transferRepo },
        {
          provide: getRepositoryToken(HospitalRegistry),
          useValue: { findOne: jest.fn().mockResolvedValue({ id: TO, email: null }) },
        },
        { provide: MedicalRecordsService, useValue: { shareWithHospital: jest.fn() } },
        { provide: AccessControlService, useValue: { revokeAccessByPatient: jest.fn() } },
        { provide: NotificationsService, useValue: { emitRecordUploaded: jest.fn() } },
        { provide: StellarService, useValue: { invokeContract: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TransferController);
  });

  describe('POST /', () => {
    it('stores the caller hospital and user from the principal', async () => {
      transferRepo.findOne.mockResolvedValue(null);

      const result = await controller.initiateTransfer(
        { patientId: 'patient-1', patientName: 'Jane Doe', toHospitalId: TO } as any,
        principal(FROM, 'user-1'),
      );

      expect(result.fromHospitalId).toBe(FROM);
      expect(result.initiatedBy).toBe('user-1');
    });

    it('rejects a caller with no hospital', async () => {
      await expect(
        controller.initiateTransfer(
          { patientId: 'patient-1', patientName: 'Jane Doe', toHospitalId: TO } as any,
          { user: { userId: 'user-1', role: 'physician' } },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('POST /:id/accept', () => {
    it('lets the destination hospital accept', async () => {
      transferRepo.findOne.mockResolvedValue(pendingTransfer());

      const result = await controller.acceptTransfer(
        'transfer-1',
        { acceptedBy: 'user-1' },
        principal(TO, 'user-to'),
      );

      expect(result.status).toBe(TransferStatus.COMPLETED);
      expect(result.acceptedBy).toBe('user-to');
    });

    it('returns 403 for the source and unrelated hospitals', async () => {
      transferRepo.findOne.mockResolvedValue(pendingTransfer());
      await expect(
        controller.acceptTransfer('transfer-1', { acceptedBy: 'x' }, principal(FROM)),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.acceptTransfer('transfer-1', { acceptedBy: 'x' }, principal(OTHER)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('POST /:id/reject', () => {
    it('lets the destination hospital reject', async () => {
      transferRepo.findOne.mockResolvedValue(pendingTransfer());

      const result = await controller.rejectTransfer(
        'transfer-1',
        { reason: 'No beds' } as any,
        principal(TO, 'user-to'),
      );

      expect(result.status).toBe(TransferStatus.REJECTED);
      expect(result.rejectedBy).toBe('user-to');
    });

    it('returns 403 for an unrelated hospital', async () => {
      transferRepo.findOne.mockResolvedValue(pendingTransfer());
      await expect(
        controller.rejectTransfer('transfer-1', { reason: 'x' } as any, principal(OTHER)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('POST /:id/cancel', () => {
    it('lets the source hospital cancel', async () => {
      transferRepo.findOne.mockResolvedValue(pendingTransfer());

      const result = await controller.cancelTransfer(
        'transfer-1',
        { reason: 'Patient recovered' } as any,
        principal(FROM, 'user-from'),
      );

      expect(result.status).toBe(TransferStatus.CANCELLED);
      expect(result.cancelledBy).toBe('user-from');
    });

    it('returns 403 for the destination and unrelated hospitals', async () => {
      transferRepo.findOne.mockResolvedValue(pendingTransfer());
      await expect(
        controller.cancelTransfer('transfer-1', { reason: 'x' } as any, principal(TO)),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.cancelTransfer('transfer-1', { reason: 'x' } as any, principal(OTHER)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GET /:id', () => {
    it('returns the transfer to the source and destination hospitals', async () => {
      transferRepo.findOne.mockResolvedValue(pendingTransfer());
      await expect(controller.getTransfer('transfer-1', principal(FROM))).resolves.toMatchObject({
        id: 'transfer-1',
      });
      await expect(controller.getTransfer('transfer-1', principal(TO))).resolves.toMatchObject({
        id: 'transfer-1',
      });
    });

    it('returns 403 to an unrelated hospital', async () => {
      transferRepo.findOne.mockResolvedValue(pendingTransfer());
      await expect(controller.getTransfer('transfer-1', principal(OTHER))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('GET /', () => {
    it('scopes the query to the caller hospital and applies filters', async () => {
      await controller.listTransfers(principal(FROM), 'patient-1', undefined, undefined, TransferStatus.PENDING);

      const { where } = transferRepo.find.mock.calls[0][0];
      expect(where).toEqual([
        expect.objectContaining({ patientId: 'patient-1', status: TransferStatus.PENDING, fromHospitalId: FROM }),
        expect.objectContaining({ patientId: 'patient-1', status: TransferStatus.PENDING, toHospitalId: FROM }),
      ]);
    });

    it('returns 403 to a caller with no hospital', async () => {
      await expect(
        controller.listTransfers({ user: { userId: 'user-1', role: 'physician' } }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
