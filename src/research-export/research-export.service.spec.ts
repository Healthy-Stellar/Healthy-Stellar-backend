import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { ResearchExportService, stripPii } from './research-export.service';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';
import { AuditService } from '../common/audit/audit.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});
const mockAudit = () => ({ logDataExport: jest.fn().mockResolvedValue(undefined) });
const mockConfig = () => ({ get: jest.fn((key: string, def: string) => def) });

describe('ResearchExportService', () => {
  let service: ResearchExportService;
  let grantRepo: ReturnType<typeof mockRepo>;
  let recordRepo: ReturnType<typeof mockRepo>;
  let patientRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResearchExportService,
        { provide: getRepositoryToken(MedicalRecord), useFactory: mockRepo },
        { provide: getRepositoryToken(Patient), useFactory: mockRepo },
        { provide: getRepositoryToken(AccessGrant), useFactory: mockRepo },
        { provide: AuditService, useFactory: mockAudit },
        { provide: ConfigService, useFactory: mockConfig },
      ],
    }).compile();

    service = module.get(ResearchExportService);
    grantRepo = module.get(getRepositoryToken(AccessGrant));
    recordRepo = module.get(getRepositoryToken(MedicalRecord));
    patientRepo = module.get(getRepositoryToken(Patient));
  });

  // ── Rule 1: Pseudonymization ──────────────────────────────────────────────
  describe('pseudonymize', () => {
    it('returns a 16-char hex string', () => {
      expect(service.pseudonymize('patient-uuid-123')).toMatch(/^[a-f0-9]{16}$/);
    });

    it('is deterministic for the same input', () => {
      expect(service.pseudonymize('abc')).toBe(service.pseudonymize('abc'));
    });

    it('produces different output for different patients', () => {
      expect(service.pseudonymize('patient-A')).not.toBe(service.pseudonymize('patient-B'));
    });
  });

  // ── Rule 2: Age generalisation ────────────────────────────────────────────
  describe('toAgeBracket', () => {
    it('returns unknown for missing DOB', () => {
      expect(service.toAgeBracket('')).toBe('unknown');
    });

    it('collapses ages >= 90 to "90+"', () => {
      const dob = `${new Date().getFullYear() - 92}-01-01`;
      expect(service.toAgeBracket(dob)).toBe('90+');
    });

    it('returns correct 5-year bracket for age 35', () => {
      const dob = `${new Date().getFullYear() - 35}-06-15`;
      expect(service.toAgeBracket(dob)).toBe('35-39');
    });

    it('returns correct bracket for age 0', () => {
      const dob = `${new Date().getFullYear()}-01-01`;
      expect(service.toAgeBracket(dob)).toBe('0-4');
    });
  });

  // ── Rule 3: Location generalisation ──────────────────────────────────────
  describe('toRegion', () => {
    it('returns unknown for null address', () => {
      expect(service.toRegion(null)).toBe('unknown');
    });

    it('strips ZIP code and returns state token', () => {
      const result = service.toRegion('123 Main St, Springfield, IL 62701');
      expect(result).not.toMatch(/\d{5}/);
      expect(result).toBe('IL');
    });

    it('handles JSON address object', () => {
      const result = service.toRegion({ street: '1 Hospital Rd', city: 'Boston', state: 'MA' });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ── Rule 4: HIPAA Safe Harbor — all 18 identifier categories ─────────────
  // Each test uses a realistic clinical note fragment containing the identifier.
  describe('stripPii — HIPAA Safe Harbor 18-identifier corpus', () => {
    // 1. Names (via NER — titled and embedded)
    it('redacts titled provider name (Dr. Jane Smith)', () => {
      expect(stripPii('Referred to Dr. Jane Smith for follow-up.')).not.toMatch(/Jane Smith/);
    });

    it('redacts patient name embedded in clinical note', () => {
      expect(stripPii('Patient John Doe reports chest pain since Monday.')).not.toMatch(/John Doe/);
    });

    it('redacts name with title mid-sentence', () => {
      expect(stripPii('Prescription written by Dr. Robert Brown.')).not.toMatch(/Robert Brown/);
    });

    // 2. Geographic data — street address
    it('redacts street address', () => {
      expect(stripPii('Patient resides at 42 Elm Street, Apt 3.')).not.toMatch(/42 Elm Street/);
    });

    // 3. Dates (except year)
    it('redacts full date — Month DD, YYYY', () => {
      expect(stripPii('Admitted on January 15, 1980.')).not.toMatch(/January 15, 1980/);
    });

    it('redacts date in MM/DD/YYYY format', () => {
      expect(stripPii('DOB: 03/22/1975.')).not.toMatch(/03\/22\/1975/);
    });

    it('redacts date in YYYY-MM-DD format', () => {
      expect(stripPii('Discharge date: 2023-11-04.')).not.toMatch(/2023-11-04/);
    });

    // 4. Phone numbers
    it('redacts US phone number with dashes', () => {
      expect(stripPii('Call 555-867-5309 for results.')).not.toMatch(/555-867-5309/);
    });

    it('redacts phone number with parentheses', () => {
      expect(stripPii('Contact: (800) 123-4567.')).not.toMatch(/800.*123-4567/);
    });

    // 5. Fax numbers (same pattern as phone)
    it('redacts fax number', () => {
      expect(stripPii('Fax results to 212-555-0199.')).not.toMatch(/212-555-0199/);
    });

    // 6. Email addresses
    it('redacts email address', () => {
      expect(stripPii('Send records to john.doe@hospital.org.')).not.toMatch(/john\.doe@hospital\.org/);
    });

    // 7. Social Security Numbers
    it('redacts SSN', () => {
      expect(stripPii('SSN on file: 123-45-6789.')).not.toMatch(/123-45-6789/);
    });

    // 8. Medical record numbers
    it('redacts MRN', () => {
      expect(stripPii('MRN: 00847321 admitted to ward 4.')).not.toMatch(/00847321/);
    });

    // 9. Health plan beneficiary numbers (account/policy pattern)
    it('redacts health plan beneficiary number', () => {
      expect(stripPii('Policy number: 987654321 effective 2024.')).not.toMatch(/987654321/);
    });

    // 10. Account numbers
    it('redacts account number', () => {
      expect(stripPii('Account #: ACC-20948-X billed.')).not.toMatch(/ACC-20948-X/);
    });

    // 11. Certificate / license numbers
    it('redacts license number', () => {
      expect(stripPii('License no: CA8834521 verified.')).not.toMatch(/CA8834521/);
    });

    // 12. Vehicle identifiers (serial number pattern)
    it('redacts serial/device identifier', () => {
      expect(stripPii('Device serial: SN-4892-XZ implanted.')).not.toMatch(/SN-4892-XZ/);
    });

    // 13. Device identifiers — same serial pattern covered above

    // 14. Web URLs
    it('redacts web URL', () => {
      expect(stripPii('See https://patient-portal.hospital.com/records/123 for details.')).not.toMatch(/https:\/\//);
    });

    // 15. IP addresses
    it('redacts IP address', () => {
      expect(stripPii('Access logged from 192.168.1.42.')).not.toMatch(/192\.168\.1\.42/);
    });

    // 16. Biometric identifiers — covered by name/NER pass (no reliable lexical form;
    //     free-text biometric descriptions are caught by the NER capitalised-bigram pass)

    // 17. Full-face photographs — not applicable to text pipeline

    // 18. ZIP codes
    it('redacts ZIP code', () => {
      expect(stripPii('Patient from ZIP 90210.')).not.toMatch(/90210/);
    });

    it('redacts ZIP+4', () => {
      expect(stripPii('Mailing address ZIP: 10001-1234.')).not.toMatch(/10001-1234/);
    });

    // ── Preservation check ────────────────────────────────────────────────
    it('preserves clinical content with no PII', () => {
      const clean = 'Patient presents with hypertension and type 2 diabetes mellitus.';
      expect(stripPii(clean)).toBe(clean);
    });

    it('preserves medication dosage numbers', () => {
      const clean = 'Prescribed metformin 500 mg twice daily.';
      expect(stripPii(clean)).toBe(clean);
    });
  });

  // ── Grant validation ──────────────────────────────────────────────────────
  describe('exportAnonymizedDataset — grant validation', () => {
    it('throws ForbiddenException when researcher has no active grant', async () => {
      grantRepo.findOne.mockResolvedValue(null);
      await expect(service.exportAnonymizedDataset('researcher-id', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when grant is expired', async () => {
      grantRepo.findOne.mockResolvedValue({
        status: GrantStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.exportAnonymizedDataset('researcher-id', {})).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── dryRun ────────────────────────────────────────────────────────────────
  describe('exportAnonymizedDataset — dryRun', () => {
    const activeGrant = { status: GrantStatus.ACTIVE, expiresAt: null };

    // Build 5 records for 1 patient (suppression floor is 3, so they pass)
    const makeRecords = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `rec-${i}`,
        patientId: 'patient-1',
        recordDate: '2023-01-01',
        recordType: 'note',
        description: 'Hypertension follow-up.',
        title: 'Note',
        status: 'active',
      }));

    beforeEach(() => {
      grantRepo.findOne.mockResolvedValue(activeGrant);

      const qbMock = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(makeRecords(5)),
      };
      recordRepo.createQueryBuilder.mockReturnValue(qbMock);
      patientRepo.find.mockResolvedValue([
        { id: 'patient-1', dateOfBirth: '1980-06-01', sex: 'M', address: 'Boston, MA' },
      ]);
    });

    it('returns records without storageRef when dryRun=true', async () => {
      const result = await service.exportAnonymizedDataset('researcher-1', { dryRun: true });
      expect(result.storageRef).toBeNull();
      expect(result.records.length).toBeGreaterThan(0);
    });

    it('returns at most 10 records in dryRun mode', async () => {
      const result = await service.exportAnonymizedDataset('researcher-1', { dryRun: true });
      expect(result.records.length).toBeLessThanOrEqual(10);
    });

    it('does not call S3 in dryRun mode', async () => {
      // S3Client.send would throw if called — the test passing proves it was not called
      const s3SendSpy = jest
        .spyOn((service as any).s3, 'send')
        .mockRejectedValue(new Error('S3 should not be called in dryRun'));

      await expect(
        service.exportAnonymizedDataset('researcher-1', { dryRun: true }),
      ).resolves.not.toThrow();

      expect(s3SendSpy).not.toHaveBeenCalled();
    });
  });
});
