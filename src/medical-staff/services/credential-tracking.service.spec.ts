import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CredentialTrackingService } from './credential-tracking.service';
import {
  StaffCredential,
  CredentialStatus,
  CredentialType,
} from '../entities/staff-credential.entity';
import { Doctor, LicenseStatus, StaffStatus } from '../entities/doctor.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';

const makeRepo = (overrides: Partial<any> = {}) => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((x) => x),
  save: jest.fn().mockImplementation((x) => Promise.resolve({ id: 'cred-1', ...x })),
  ...overrides,
});

const FUTURE_DATE = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const PAST_DATE = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const NEAR_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

describe('CredentialTrackingService', () => {
  let service: CredentialTrackingService;
  let credentialRepo: ReturnType<typeof makeRepo>;
  let doctorRepo: ReturnType<typeof makeRepo>;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    credentialRepo = makeRepo();
    doctorRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({
        id: 'doc-1',
        status: StaffStatus.ACTIVE,
        licenseStatus: LicenseStatus.ACTIVE,
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CredentialTrackingService,
        { provide: getRepositoryToken(StaffCredential), useValue: credentialRepo },
        { provide: getRepositoryToken(Doctor), useValue: doctorRepo },
        {
          provide: NotificationsService,
          useValue: { emitRecordAmended: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CredentialTrackingService>(CredentialTrackingService);
    notificationsService = module.get(NotificationsService);
  });

  describe('addCredential', () => {
    it('creates an ACTIVE credential for a future expiry date', async () => {
      const dto = {
        staffId: 'doc-1',
        type: CredentialType.MEDICAL_LICENSE,
        credentialNumber: 'ML-12345',
        issuingBody: 'State Medical Board',
        issuedAt: '2020-01-01',
        expiresAt: FUTURE_DATE,
      };

      const result = await service.addCredential(dto as any);

      expect(credentialRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(CredentialStatus.ACTIVE);
    });

    it('creates an EXPIRING_SOON credential for a near-future expiry date', async () => {
      const dto = {
        staffId: 'doc-1',
        type: CredentialType.MEDICAL_LICENSE,
        credentialNumber: 'ML-99999',
        issuingBody: 'State Medical Board',
        issuedAt: '2018-01-01',
        expiresAt: NEAR_DATE,
      };

      const result = await service.addCredential(dto as any);

      expect(result.status).toBe(CredentialStatus.EXPIRING_SOON);
    });

    it('creates an EXPIRED credential for a past expiry date', async () => {
      const dto = {
        staffId: 'doc-1',
        type: CredentialType.MEDICAL_LICENSE,
        credentialNumber: 'ML-00001',
        issuingBody: 'State Medical Board',
        issuedAt: '2010-01-01',
        expiresAt: PAST_DATE,
      };

      const result = await service.addCredential(dto as any);

      expect(result.status).toBe(CredentialStatus.EXPIRED);
    });

    it('throws NotFoundException when staff member does not exist', async () => {
      doctorRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addCredential({
          staffId: 'unknown',
          type: CredentialType.MEDICAL_LICENSE,
          credentialNumber: 'ML-X',
          issuingBody: 'Board',
          issuedAt: '2020-01-01',
          expiresAt: FUTURE_DATE,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertCredentialValid', () => {
    it('throws BadRequestException when required credential is expired', async () => {
      credentialRepo.findOne.mockResolvedValue({
        type: CredentialType.MEDICAL_LICENSE,
        status: CredentialStatus.EXPIRED,
        expiresAt: new Date(PAST_DATE),
      });

      await expect(
        service.assertCredentialValid('doc-1', CredentialType.MEDICAL_LICENSE),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows action when credential is ACTIVE', async () => {
      credentialRepo.findOne.mockResolvedValue({
        type: CredentialType.MEDICAL_LICENSE,
        status: CredentialStatus.ACTIVE,
        expiresAt: new Date(FUTURE_DATE),
      });

      await expect(
        service.assertCredentialValid('doc-1', CredentialType.MEDICAL_LICENSE),
      ).resolves.toBeUndefined();
    });

    it('throws BadRequestException when required credential is missing', async () => {
      credentialRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assertCredentialValid('doc-1', CredentialType.MEDICAL_LICENSE),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkCredentialExpirations (scheduled job)', () => {
    it('sends reminders and marks credentials as EXPIRING_SOON', async () => {
      const nearExpiry = {
        id: 'cred-near',
        staffId: 'doc-1',
        type: CredentialType.BOARD_CERTIFICATION,
        status: CredentialStatus.ACTIVE,
        reminderSent: false,
        expiresAt: new Date(NEAR_DATE),
      };

      credentialRepo.find
        .mockResolvedValueOnce([nearExpiry])
        .mockResolvedValueOnce([]);

      await service.checkCredentialExpirations();

      expect(credentialRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CredentialStatus.EXPIRING_SOON, reminderSent: true }),
      );
      expect(notificationsService.emitRecordAmended).toHaveBeenCalledWith(
        'system',
        'doc-1',
        expect.objectContaining({ type: 'credential_expiry_reminder' }),
      );
    });

    it('suspends staff and notifies when a required credential expires', async () => {
      const expiredLicense = {
        id: 'cred-exp',
        staffId: 'doc-1',
        type: CredentialType.MEDICAL_LICENSE,
        status: CredentialStatus.ACTIVE,
        expiresAt: new Date(PAST_DATE),
      };

      credentialRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([expiredLicense]);

      const savedDoctor = {
        id: 'doc-1',
        status: StaffStatus.ACTIVE,
        licenseStatus: LicenseStatus.ACTIVE,
      };
      doctorRepo.findOne.mockResolvedValue(savedDoctor);

      await service.checkCredentialExpirations();

      expect(doctorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: StaffStatus.SUSPENDED,
          licenseStatus: LicenseStatus.EXPIRED,
        }),
      );
      expect(notificationsService.emitRecordAmended).toHaveBeenCalledWith(
        'system',
        'doc-1',
        expect.objectContaining({ type: 'credential_expired' }),
      );
    });
  });
});
