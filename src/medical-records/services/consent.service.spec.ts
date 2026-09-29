import 'reflect-metadata';

jest.mock('../entities/medical-record-consent.entity', () => ({
  ConsentStatus: {
    PENDING: 'pending',
    GRANTED: 'granted',
    REVOKED: 'revoked',
    EXPIRED: 'expired',
  },
  ConsentType: {
    VIEW: 'view',
    SHARE: 'share',
    DOWNLOAD: 'download',
    MODIFY: 'modify',
    DELETE: 'delete',
  },
  MedicalRecordConsent: class MedicalRecordConsent {},
}));

jest.mock('../entities/medical-history.entity', () => ({
  MedicalHistory: class MedicalHistory {},
  HistoryEventType: {
    CONSENT_GRANTED: 'consent_granted',
    CONSENT_REVOKED: 'consent_revoked',
  },
}));

import { ConsentService } from './consent.service';
import { ConsentType, ConsentStatus } from '../entities/medical-record-consent.entity';
import { IsNull, MoreThan } from 'typeorm';

describe('ConsentService', () => {
  it('treats nullable expiry as active consent', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'consent-1' }),
    };

    const service = new ConsentService(
      repo as any,
      { save: jest.fn() } as any,
      { findOne: jest.fn() } as any,
    );

    await service.checkConsent('record-1', 'user-1', ConsentType.VIEW);

    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          expect.objectContaining({
            medicalRecordId: 'record-1',
            sharedWithUserId: 'user-1',
            consentType: ConsentType.VIEW,
            status: ConsentStatus.GRANTED,
            expiresAt: IsNull(),
          }),
          expect.objectContaining({
            medicalRecordId: 'record-1',
            sharedWithUserId: 'user-1',
            consentType: ConsentType.VIEW,
            status: ConsentStatus.GRANTED,
            expiresAt: MoreThan(expect.any(Date)),
          }),
        ]),
      }),
    );
  });

  it('returns false for revoked or expired consents', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new ConsentService(
      repo as any,
      { save: jest.fn() } as any,
      { findOne: jest.fn() } as any,
    );

    await expect(service.checkConsent('record-1', 'user-1', ConsentType.VIEW)).resolves.toBe(false);
    expect(repo.findOne).toHaveBeenCalled();
  });
});
