import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EmergencyQrService } from './emergency-qr.service';
import { EmergencyMedicalInfo, BloodType } from '../entities/emergency-medical-info.entity';

const MOCK_TOKEN = '11111111-1111-1111-1111-111111111111';

function makeRecord(overrides: Partial<EmergencyMedicalInfo> = {}): EmergencyMedicalInfo {
  return {
    id: 'emi-1',
    patientId: 'patient-1',
    bloodType: BloodType.O_POS,
    allergies: ['penicillin'],
    currentMedications: ['aspirin'],
    chronicConditions: [],
    dnrStatus: false,
    emergencyContacts: [{ name: 'Jane', relationship: 'spouse', phone: '555-0100' }],
    insuranceInfo: null,
    additionalNotes: null,
    qrOptIn: false,
    qrToken: null,
    qrIssuedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as EmergencyMedicalInfo;
}

function buildModule(record: EmergencyMedicalInfo | null = makeRecord()) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(record),
    save: jest.fn().mockImplementation(async (r) => r),
  };

  const config = { get: jest.fn().mockImplementation((key: string, def: string) => def) };

  return Test.createTestingModule({
    providers: [
      EmergencyQrService,
      { provide: getRepositoryToken(EmergencyMedicalInfo), useValue: repo },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();
}

describe('EmergencyQrService', () => {
  describe('generateOptIn', () => {
    it('sets qrOptIn=true, issues a token, and returns a verifyUrl', async () => {
      const module: TestingModule = await buildModule();
      const svc = module.get(EmergencyQrService);

      const result = await svc.generateOptIn('patient-1');

      expect(result.verifyUrl).toContain('/emergency-medical-info/qr/verify/');
      expect(result.issuedAt).toBeDefined();
    });

    it('reuses existing token when within 30-day window', async () => {
      const record = makeRecord({
        qrOptIn: true,
        qrToken: MOCK_TOKEN,
        qrIssuedAt: new Date(), // just now
      });
      const module = await buildModule(record);
      const svc = module.get(EmergencyQrService);
      const repo = module.get(getRepositoryToken(EmergencyMedicalInfo));

      await svc.generateOptIn('patient-1');

      const saved = (repo.save as jest.Mock).mock.calls[0][0];
      expect(saved.qrToken).toBe(MOCK_TOKEN);
    });

    it('rotates token when older than 30 days', async () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      const record = makeRecord({ qrOptIn: true, qrToken: MOCK_TOKEN, qrIssuedAt: oldDate });
      const module = await buildModule(record);
      const svc = module.get(EmergencyQrService);
      const repo = module.get(getRepositoryToken(EmergencyMedicalInfo));

      await svc.generateOptIn('patient-1');

      const saved = (repo.save as jest.Mock).mock.calls[0][0];
      expect(saved.qrToken).not.toBe(MOCK_TOKEN);
    });

    it('throws NotFoundException when record not found', async () => {
      const module = await buildModule(null);
      const svc = module.get(EmergencyQrService);
      await expect(svc.generateOptIn('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeOptIn', () => {
    it('sets qrOptIn=false and nulls the token', async () => {
      const record = makeRecord({ qrOptIn: true, qrToken: MOCK_TOKEN, qrIssuedAt: new Date() });
      const module = await buildModule(record);
      const svc = module.get(EmergencyQrService);
      const repo = module.get(getRepositoryToken(EmergencyMedicalInfo));

      await svc.revokeOptIn('patient-1');

      const saved = (repo.save as jest.Mock).mock.calls[0][0];
      expect(saved.qrOptIn).toBe(false);
      expect(saved.qrToken).toBeNull();
    });
  });

  describe('downloadPng', () => {
    it('returns a Buffer when opt-in is valid', async () => {
      const record = makeRecord({ qrOptIn: true, qrToken: MOCK_TOKEN, qrIssuedAt: new Date() });
      const module = await buildModule(record);
      const svc = module.get(EmergencyQrService);

      const buf = await svc.downloadPng('patient-1');
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('throws BadRequestException when not opted in', async () => {
      const module = await buildModule(makeRecord({ qrOptIn: false }));
      const svc = module.get(EmergencyQrService);
      await expect(svc.downloadPng('patient-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token is expired', async () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      const record = makeRecord({ qrOptIn: true, qrToken: MOCK_TOKEN, qrIssuedAt: oldDate });
      const module = await buildModule(record);
      const svc = module.get(EmergencyQrService);
      await expect(svc.downloadPng('patient-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verify', () => {
    it('returns decoded data for a valid, signed token', async () => {
      const record = makeRecord({ qrOptIn: true, qrToken: MOCK_TOKEN, qrIssuedAt: new Date() });
      // findOne is called with { where: { qrToken: token } }
      const repo = {
        findOne: jest.fn().mockResolvedValue(record),
        save: jest.fn().mockImplementation(async (r) => r),
      };
      const config = { get: jest.fn().mockImplementation((_k: string, def: string) => def) };
      const mod = await Test.createTestingModule({
        providers: [
          EmergencyQrService,
          { provide: getRepositoryToken(EmergencyMedicalInfo), useValue: repo },
          { provide: ConfigService, useValue: config },
        ],
      }).compile();
      const svc = mod.get(EmergencyQrService);

      const result = await svc.verify(MOCK_TOKEN);

      expect(result.patientId).toBe('patient-1');
      expect(result.bloodType).toBe(BloodType.O_POS);
      expect(result.allergies).toEqual(['penicillin']);
      expect(result.dnrStatus).toBe(false);
    });

    it('throws NotFoundException when token not found', async () => {
      const repo = { findOne: jest.fn().mockResolvedValue(null) };
      const config = { get: jest.fn().mockImplementation((_k: string, def: string) => def) };
      const mod = await Test.createTestingModule({
        providers: [
          EmergencyQrService,
          { provide: getRepositoryToken(EmergencyMedicalInfo), useValue: repo },
          { provide: ConfigService, useValue: config },
        ],
      }).compile();
      const svc = mod.get(EmergencyQrService);
      await expect(svc.verify('bad-token')).rejects.toThrow(NotFoundException);
    });
  });
});
