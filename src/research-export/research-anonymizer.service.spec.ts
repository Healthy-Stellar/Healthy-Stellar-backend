import { UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ResearchAnonymizerService,
  RESEARCH_EXPORT_MIN_K,
} from './research-anonymizer.service';
import { AnonymizedStreamRow } from './dto/research-export.dto';

const mockConfig = () => ({ get: jest.fn((_key: string, def: string) => def) });

describe('ResearchAnonymizerService', () => {
  let service: ResearchAnonymizerService;

  beforeEach(() => {
    service = new ResearchAnonymizerService(mockConfig() as unknown as ConfigService);
  });

  // ── Direct identifier hashing ─────────────────────────────────────────────
  describe('hashIdentifier', () => {
    it('returns a hex digest', () => {
      expect(service.hashIdentifier('patient-uuid-123')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is deterministic for the same input', () => {
      expect(service.hashIdentifier('patient-1')).toBe(service.hashIdentifier('patient-1'));
    });

    it('produces different output for different patients', () => {
      expect(service.hashIdentifier('patient-A')).not.toBe(service.hashIdentifier('patient-B'));
    });

    it('does not embed the original identifier in the hash', () => {
      const hash = service.hashIdentifier('a-very-unique-patient-id');
      expect(hash).not.toContain('a-very-unique-patient-id');
    });
  });

  // ── DOB -> age range generalisation ───────────────────────────────────────
  describe('toAgeRange', () => {
    it('returns "unknown" for missing DOB', () => {
      expect(service.toAgeRange(undefined)).toBe('unknown');
      expect(service.toAgeRange(null)).toBe('unknown');
      expect(service.toAgeRange('')).toBe('unknown');
    });

    it('returns "unknown" for an unparsable DOB', () => {
      expect(service.toAgeRange('not-a-date')).toBe('unknown');
    });

    it('collapses ages >= 90 into "90+"', () => {
      const dob = `${new Date().getFullYear() - 95}-01-01`;
      expect(service.toAgeRange(dob)).toBe('90+');
    });

    it('returns the correct 5-year band for age 35', () => {
      const dob = `${new Date().getFullYear() - 35}-06-15`;
      expect(service.toAgeRange(dob)).toBe('35-39');
    });

    it('returns the correct band for age 0', () => {
      const dob = `${new Date().getFullYear()}-01-01`;
      expect(service.toAgeRange(dob)).toBe('0-4');
    });
  });

  // ── Address -> region generalisation ──────────────────────────────────────
  describe('toRegion', () => {
    it('returns "unknown" for a null address', () => {
      expect(service.toRegion(null)).toBe('unknown');
    });

    it('strips street/ZIP detail from a string address and keeps the region token', () => {
      const result = service.toRegion('123 Main St, Springfield, IL 62701');
      expect(result).not.toMatch(/\d{5}/);
      expect(result).not.toMatch(/Main St/);
      expect(result).toBe('IL');
    });

    it('reads the state field directly off an address object', () => {
      expect(service.toRegion({ street: '1 Hospital Rd', city: 'Boston', state: 'MA' })).toBe('MA');
    });

    it('falls back to country when no state/region/province is present', () => {
      expect(service.toRegion({ street: '1 Hospital Rd', country: 'UK' })).toBe('UK');
    });
  });

  // ── Full record transform ─────────────────────────────────────────────────
  describe('anonymizeRecord', () => {
    const baseRecord: any = {
      patientId: 'patient-1',
      recordType: 'note',
      recordDate: '2023-05-01',
      description: 'Patient John Doe reports chest pain. Call 555-867-5309 for results.',
      title: 'Visit note',
    };
    const basePatient: any = {
      dateOfBirth: `${new Date().getFullYear() - 42}-01-01`,
      address: { state: 'CA' },
    };

    it('does not include the raw patientId anywhere in the output', () => {
      const row = service.anonymizeRecord(baseRecord, basePatient);
      expect(JSON.stringify(row)).not.toContain('patient-1');
    });

    it('strips names and phone numbers from the free-text summary', () => {
      const row = service.anonymizeRecord(baseRecord, basePatient);
      expect(row.clinicalSummary).not.toMatch(/John Doe/);
      expect(row.clinicalSummary).not.toMatch(/555-867-5309/);
    });

    it('generalises DOB to an age range and address to a region', () => {
      const row = service.anonymizeRecord(baseRecord, basePatient);
      expect(row.ageRange).toBe('40-44');
      expect(row.region).toBe('CA');
    });

    it('reduces the record date to year only', () => {
      const row = service.anonymizeRecord(baseRecord, basePatient);
      expect(row.yearOfRecord).toBe(2023);
    });

    it('handles a missing patient gracefully', () => {
      const row = service.anonymizeRecord(baseRecord, undefined);
      expect(row.ageRange).toBe('unknown');
      expect(row.region).toBe('unknown');
    });
  });

  // ── k-anonymity enforcement ────────────────────────────────────────────────
  describe('enforceKAnonymity', () => {
    const makeRow = (overrides: Partial<AnonymizedStreamRow> = {}): AnonymizedStreamRow => ({
      pseudoId: Math.random().toString(36).slice(2),
      ageRange: '30-34',
      region: 'CA',
      recordType: 'note',
      yearOfRecord: 2023,
      clinicalSummary: 'clean',
      ...overrides,
    });

    it('uses k=5 as the default minimum group size', () => {
      expect(RESEARCH_EXPORT_MIN_K).toBe(5);
    });

    it('keeps a group that meets the k=5 threshold', () => {
      const rows = Array.from({ length: 5 }, () => makeRow());
      const result = service.enforceKAnonymity(rows);
      expect(result).toHaveLength(5);
    });

    it('suppresses a group smaller than k=5', () => {
      const safeGroup = Array.from({ length: 5 }, () => makeRow({ region: 'CA' }));
      const smallGroup = Array.from({ length: 3 }, () => makeRow({ region: 'WY' }));
      const result = service.enforceKAnonymity([...safeGroup, ...smallGroup]);

      expect(result).toHaveLength(5);
      expect(result.every((r) => r.region === 'CA')).toBe(true);
    });

    it('throws UnprocessableEntityException when no group reaches k=5', () => {
      const rows = Array.from({ length: 4 }, () => makeRow());
      expect(() => service.enforceKAnonymity(rows)).toThrow(UnprocessableEntityException);
    });

    it('throws on an empty input set', () => {
      expect(() => service.enforceKAnonymity([])).toThrow(UnprocessableEntityException);
    });

    it('treats different quasi-identifier combinations as separate groups', () => {
      const groupA = Array.from({ length: 5 }, () => makeRow({ ageRange: '30-34', region: 'CA' }));
      const groupB = Array.from({ length: 5 }, () => makeRow({ ageRange: '60-64', region: 'NY' }));
      const result = service.enforceKAnonymity([...groupA, ...groupB]);
      expect(result).toHaveLength(10);
    });

    it('honours a custom k override', () => {
      const rows = Array.from({ length: 6 }, () => makeRow());
      expect(() => service.enforceKAnonymity(rows, 10)).toThrow(UnprocessableEntityException);
      expect(service.enforceKAnonymity(rows, 5)).toHaveLength(6);
    });
  });
});
