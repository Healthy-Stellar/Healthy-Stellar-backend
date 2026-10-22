import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';
import { HipaaComplianceService } from './hipaa-compliance.service';
import { HipaaAuditLogEntity } from '../entity/hipaa-audit-log.entity';
import { PatientConsentEntity } from '../entity/patient-consent.entity';

/**
 * Tests for issue #947.
 *
 * Three defects, each covered by an assertion that fails against the previous
 * implementation rather than merely passing against this one:
 *   - a hardcoded fallback key let a deployment without ENCRYPTION_KEY start
 *     anyway, encrypting PHI under a value published in this repository;
 *   - `scryptSync(key, 'salt', 32)` used a constant salt, so deriving the key
 *     once opened every record in every deployment;
 *   - audit logs and consents lived in a process-local array and Map.
 */

const KEY = 'unit-test-encryption-key';

function repoDouble() {
  return {
    create: jest.fn((entity) => entity),
    save: jest.fn((entity) => Promise.resolve({ id: 'row-1', ...entity })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
}

async function buildService(auditRepo: any, consentRepo: any) {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      HipaaComplianceService,
      { provide: getRepositoryToken(HipaaAuditLogEntity), useValue: auditRepo },
      { provide: getRepositoryToken(PatientConsentEntity), useValue: consentRepo },
    ],
  }).compile();
  return moduleRef.get<HipaaComplianceService>(HipaaComplianceService);
}

describe('HipaaComplianceService', () => {
  let auditRepo: ReturnType<typeof repoDouble>;
  let consentRepo: ReturnType<typeof repoDouble>;
  let service: HipaaComplianceService;
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = KEY;
    auditRepo = repoDouble();
    consentRepo = repoDouble();
    service = await buildService(auditRepo, consentRepo);
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalKey;
    }
  });

  describe('key handling', () => {
    it('refuses to construct when ENCRYPTION_KEY is absent', async () => {
      delete process.env.ENCRYPTION_KEY;
      await expect(buildService(repoDouble(), repoDouble())).rejects.toThrow(
        /ENCRYPTION_KEY must be set/,
      );
    });

    it('refuses to construct when ENCRYPTION_KEY is empty', async () => {
      process.env.ENCRYPTION_KEY = '';
      await expect(buildService(repoDouble(), repoDouble())).rejects.toThrow(
        /ENCRYPTION_KEY must be set/,
      );
    });

    it('constructs when a key is present', () => {
      expect(service).toBeDefined();
    });
  });

  describe('PHI encryption', () => {
    const phi = { patientId: 'p-1', diagnosis: 'example', notes: 'free text' };

    it('round-trips an object', () => {
      expect(service.decryptPHI(service.encryptPHI(phi))).toEqual(phi);
    });

    it('never produces the same ciphertext twice for the same input', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 20; i += 1) {
        seen.add(service.encryptPHI(phi));
      }
      expect(seen.size).toBe(20);
    });

    it('derives a different key per record, so the salt is not constant', () => {
      // With a constant salt the leading 16 bytes of every envelope are
      // identical. This is the assertion the previous implementation cannot
      // satisfy, whatever else it gets right.
      const a = Buffer.from(service.encryptPHI(phi), 'base64').subarray(0, 16);
      const b = Buffer.from(service.encryptPHI(phi), 'base64').subarray(0, 16);
      expect(a.equals(b)).toBe(false);
    });

    it('rejects a payload whose ciphertext was altered', () => {
      const buf = Buffer.from(service.encryptPHI(phi), 'base64');
      buf[buf.length - 1] ^= 0xff;
      expect(() => service.decryptPHI(buf.toString('base64'))).toThrow();
    });

    it('rejects a payload whose authentication tag was altered', () => {
      const buf = Buffer.from(service.encryptPHI(phi), 'base64');
      buf[16 + 12] ^= 0xff;
      expect(() => service.decryptPHI(buf.toString('base64'))).toThrow();
    });

    it('rejects a truncated envelope rather than returning empty PHI', () => {
      expect(() => service.decryptPHI(Buffer.alloc(8).toString('base64'))).toThrow(
        /truncated or malformed/,
      );
    });

    it('round-trips values that are not objects', () => {
      expect(service.decryptPHI(service.encryptPHI('a string'))).toBe('a string');
      expect(service.decryptPHI(service.encryptPHI(null))).toBeNull();
    });
  });

  describe('audit trail', () => {
    const entry = {
      resourceType: 'MedicalRecord',
      resourceId: 'r-1',
      action: 'READ',
      userId: 'u-1',
      timestamp: new Date('2026-01-01T10:00:00Z'),
    };

    it('writes through the repository instead of process memory', async () => {
      await service.logAccess(entry);
      expect(auditRepo.save).toHaveBeenCalledTimes(1);
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: 'MedicalRecord', userId: 'u-1' }),
      );
    });

    it('keeps the supplied timestamp rather than overwriting it with now', async () => {
      await service.logAccess(entry);
      expect(auditRepo.save.mock.calls[0][0].timestamp).toEqual(entry.timestamp);
    });

    it('pushes both date bounds into the query', async () => {
      const from = new Date('2026-01-01T00:00:00Z');
      const to = new Date('2026-01-31T00:00:00Z');
      await service.getAuditLogs(undefined, undefined, from, to);
      const where = auditRepo.find.mock.calls[0][0].where;
      expect((where.timestamp as FindOperator<Date>).type).toBe('between');
    });

    it('pushes a lone start bound into the query', async () => {
      await service.getAuditLogs(undefined, undefined, new Date('2026-01-01T00:00:00Z'));
      const where = auditRepo.find.mock.calls[0][0].where;
      expect((where.timestamp as FindOperator<Date>).type).toBe('moreThanOrEqual');
    });

    it('filters by resource without a date bound', async () => {
      await service.getAuditLogs('MedicalRecord', 'r-1');
      const where = auditRepo.find.mock.calls[0][0].where;
      expect(where).toEqual({ resourceType: 'MedicalRecord', resourceId: 'r-1' });
    });
  });

  describe('patient consent', () => {
    const base = {
      patientId: 'p-1',
      consentType: 'telemedicine',
      consentGiven: true,
      consentDate: new Date('2026-01-01T00:00:00Z'),
    };

    it('persists the consent and audits that it did', async () => {
      await service.recordPatientConsent(base);
      expect(consentRepo.save).toHaveBeenCalledTimes(1);
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONSENT_RECORDED', resourceId: 'p-1' }),
      );
    });

    it('asks for the newest record for that patient and type', async () => {
      await service.verifyPatientConsent('p-1', 'telemedicine');
      expect(consentRepo.findOne).toHaveBeenCalledWith({
        where: { patientId: 'p-1', consentType: 'telemedicine' },
        order: { consentDate: 'DESC' },
      });
    });

    it('honours a consent with no expiry', async () => {
      consentRepo.findOne.mockResolvedValue({ ...base, expirationDate: null });
      await expect(service.verifyPatientConsent('p-1')).resolves.toBe(true);
    });

    it('rejects a consent whose expiry has passed', async () => {
      consentRepo.findOne.mockResolvedValue({
        ...base,
        expirationDate: new Date(Date.now() - 1000),
      });
      await expect(service.verifyPatientConsent('p-1')).resolves.toBe(false);
    });

    it('rejects a withdrawn consent even before its expiry', async () => {
      consentRepo.findOne.mockResolvedValue({
        ...base,
        consentGiven: false,
        expirationDate: new Date(Date.now() + 100000),
      });
      await expect(service.verifyPatientConsent('p-1')).resolves.toBe(false);
    });

    it('rejects when the patient has no consent on file', async () => {
      consentRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyPatientConsent('p-1')).resolves.toBe(false);
    });
  });
});
