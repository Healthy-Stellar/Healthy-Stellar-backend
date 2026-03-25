import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { ResearchExportService } from './research-export.service';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';
import { AuditService } from '../common/audit/audit.service';

const mockRepo = () => ({ findOne: jest.fn(), createQueryBuilder: jest.fn(), findByIds: jest.fn() });
const mockAudit = () => ({ logDataExport: jest.fn().mockResolvedValue(undefined) });
const mockConfig = () => ({
  get: jest.fn((key: string, def: string) => def),
});

describe('ResearchExportService — HIPAA Safe Harbor de-identification', () => {
  let service: ResearchExportService;
  let grantRepo: ReturnType<typeof mockRepo>;

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
  });

  // ── Rule 1: Pseudonymization ──────────────────────────────────────────────
  describe('pseudonymize', () => {
    it('returns a 16-char hex string', () => {
      const result = service.pseudonymize('patient-uuid-123');
      expect(result).toMatch(/^[a-f0-9]{16}$/);
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

  // ── Rule 4: PII stripping from free text ─────────────────────────────────
  describe('stripPii', () => {
    it('redacts SSN', () => {
      expect(service.stripPii('SSN: 123-45-6789')).not.toContain('123-45-6789');
    });

    it('redacts phone numbers', () => {
      expect(service.stripPii('Call 555-867-5309')).not.toContain('555-867-5309');
    });

    it('redacts email addresses', () => {
      expect(service.stripPii('Email: john@example.com')).not.toContain('john@example.com');
    });

    it('redacts street addresses', () => {
      expect(service.stripPii('Lives at 42 Elm Street')).not.toContain('42 Elm Street');
    });

    it('redacts full dates', () => {
      expect(service.stripPii('DOB: January 15, 1980')).not.toContain('January 15, 1980');
    });

    it('redacts MM/DD/YYYY dates', () => {
      expect(service.stripPii('Admitted 03/22/2021')).not.toContain('03/22/2021');
    });

    it('redacts ZIP codes', () => {
      expect(service.stripPii('ZIP 90210')).not.toContain('90210');
    });

    it('redacts titled names', () => {
      expect(service.stripPii('Treated by Dr. Smith')).not.toContain('Dr. Smith');
    });

    it('preserves clinical content without PII', () => {
      const clean = 'Patient presents with hypertension and type 2 diabetes.';
      expect(service.stripPii(clean)).toBe(clean);
    });
  });

  // ── Rule 5: Small-group suppression ──────────────────────────────────────
  describe('exportAnonymizedDataset — small-group suppression', () => {
    it('throws ForbiddenException when researcher has no active grant', async () => {
      grantRepo.findOne.mockResolvedValue(null);
      await expect(
        service.exportAnonymizedDataset('researcher-id', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when grant is expired', async () => {
      grantRepo.findOne.mockResolvedValue({
        status: GrantStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.exportAnonymizedDataset('researcher-id', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
