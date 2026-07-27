import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RelatedRecordsService } from './related-records.service';
import { Record as MedicalRecord } from '../entities/record.entity';
import { RecordType } from '../dto/create-record.dto';
import { AccessControlService } from '../../access-control/services/access-control.service';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function makeRecord(overrides: Partial<MedicalRecord> = {}): MedicalRecord {
  const base: MedicalRecord = {
    id: 'rec-1',
    patientId: 'patient-1',
    providerId: null,
    cid: 'cid-1',
    stellarTxHash: 'tx-1',
    recordType: RecordType.LAB_RESULT,
    description: null,
    createdAt: new Date('2026-01-15T00:00:00Z'),
  } as MedicalRecord;
  return { ...base, ...overrides };
}

describe('RelatedRecordsService — scoring', () => {
  let service: RelatedRecordsService;

  const mockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockAccessControl = {
    verifyAccess: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelatedRecordsService,
        { provide: getRepositoryToken(MedicalRecord), useValue: mockRepo },
        { provide: AccessControlService, useValue: mockAccessControl },
      ],
    }).compile();

    service = module.get<RelatedRecordsService>(RelatedRecordsService);
    jest.clearAllMocks();
  });

  // ── Pure scoring unit tests ─────────────────────────────────────────────────

  describe('score()', () => {
    const source = makeRecord({
      id: 'src',
      recordType: RecordType.LAB_RESULT,
      providerId: 'provider-1',
      createdAt: new Date('2026-01-15T00:00:00Z'),
    });

    it('awards 3pts for same type', () => {
      const candidate = makeRecord({ id: 'c1', recordType: RecordType.LAB_RESULT, providerId: null });
      const { score, reasons } = service.score(source, candidate);
      expect(score).toBeGreaterThanOrEqual(3);
      expect(reasons).toContain('same_type');
    });

    it('awards 2pts for same provider', () => {
      const candidate = makeRecord({
        id: 'c2',
        recordType: RecordType.IMAGING, // different type, no related type
        providerId: 'provider-1',
        createdAt: new Date('2026-03-01T00:00:00Z'), // outside 30 days
      });
      const { score, reasons } = service.score(source, candidate);
      expect(score).toBe(2);
      expect(reasons).toContain('same_provider');
    });

    it('awards 1pt for within 30 days', () => {
      const candidate = makeRecord({
        id: 'c3',
        recordType: RecordType.IMAGING,
        providerId: null,
        createdAt: new Date('2026-01-20T00:00:00Z'), // 5 days later
      });
      const { score, reasons } = service.score(source, candidate);
      expect(score).toBe(1);
      expect(reasons).toContain('within_30_days');
    });

    it('awards max 6pts for same type + same provider + within 30 days', () => {
      const candidate = makeRecord({
        id: 'c4',
        recordType: RecordType.LAB_RESULT,
        providerId: 'provider-1',
        createdAt: new Date('2026-01-20T00:00:00Z'),
      });
      const { score, reasons } = service.score(source, candidate);
      expect(score).toBe(6);
      expect(reasons).toContain('same_type');
      expect(reasons).toContain('same_provider');
      expect(reasons).toContain('within_30_days');
    });

    it('awards 1pt for related type (LAB_RESULT → CONSULTATION)', () => {
      const candidate = makeRecord({
        id: 'c5',
        recordType: RecordType.CONSULTATION,
        providerId: null,
        createdAt: new Date('2026-03-01T00:00:00Z'), // outside 30 days
      });
      const { score, reasons } = service.score(source, candidate);
      expect(score).toBe(1);
      expect(reasons).toContain('related_type');
    });

    it('scores 0 for unrelated type, different provider, outside 30 days', () => {
      const candidate = makeRecord({
        id: 'c6',
        recordType: RecordType.IMAGING,
        providerId: 'provider-99',
        createdAt: new Date('2025-01-01T00:00:00Z'), // far in the past
      });
      const { score } = service.score(source, candidate);
      expect(score).toBe(0);
    });

    it('does not award same_provider when either providerId is null', () => {
      const candidate = makeRecord({
        id: 'c7',
        recordType: RecordType.IMAGING,
        providerId: null,
        createdAt: new Date('2026-03-01T00:00:00Z'),
      });
      const { reasons } = service.score(source, candidate);
      expect(reasons).not.toContain('same_provider');
    });

    it('boundary: exactly 30 days apart earns within_30_days', () => {
      const exactly30 = new Date(source.createdAt.getTime() + THIRTY_DAYS_MS);
      const candidate = makeRecord({ id: 'c8', recordType: RecordType.IMAGING, createdAt: exactly30 });
      const { reasons } = service.score(source, candidate);
      expect(reasons).toContain('within_30_days');
    });

    it('boundary: 30 days + 1ms does NOT earn within_30_days', () => {
      const justOver = new Date(source.createdAt.getTime() + THIRTY_DAYS_MS + 1);
      const candidate = makeRecord({ id: 'c9', recordType: RecordType.IMAGING, createdAt: justOver });
      const { reasons } = service.score(source, candidate);
      expect(reasons).not.toContain('within_30_days');
    });
  });

  // ── findRelated integration tests ───────────────────────────────────────────

  describe('findRelated()', () => {
    const source = makeRecord({ id: 'src', patientId: 'patient-1', recordType: RecordType.LAB_RESULT });

    it('throws NotFoundException when source record does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findRelated('missing-id', 'patient-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when requester has no access to source', async () => {
      mockRepo.findOne.mockResolvedValue(source);
      mockAccessControl.verifyAccess.mockResolvedValue(false);
      await expect(service.findRelated('src', 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('returns empty array when no candidates exist', async () => {
      mockRepo.findOne.mockResolvedValue(source);
      mockRepo.find.mockResolvedValue([]);
      const result = await service.findRelated('src', 'patient-1');
      expect(result).toEqual([]);
    });

    it('returns at most 10 results', async () => {
      mockRepo.findOne.mockResolvedValue(source);
      // 15 candidates all with score > 0 (same type, within 30 days)
      const candidates = Array.from({ length: 15 }, (_, i) =>
        makeRecord({
          id: `c${i}`,
          recordType: RecordType.LAB_RESULT,
          createdAt: new Date('2026-01-16T00:00:00Z'),
        }),
      );
      mockRepo.find.mockResolvedValue(candidates);
      mockAccessControl.verifyAccess.mockResolvedValue(true);

      const result = await service.findRelated('src', 'patient-1');
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('filters out candidates the requester cannot access', async () => {
      mockRepo.findOne.mockResolvedValue(source);
      const candidates = [
        makeRecord({ id: 'allowed', recordType: RecordType.LAB_RESULT, createdAt: new Date('2026-01-16T00:00:00Z') }),
        makeRecord({ id: 'denied', recordType: RecordType.LAB_RESULT, createdAt: new Date('2026-01-17T00:00:00Z') }),
      ];
      mockRepo.find.mockResolvedValue(candidates);
      mockAccessControl.verifyAccess
        .mockImplementation((_requesterId: string, recordId: string) =>
          Promise.resolve(recordId === 'allowed'),
        );

      const result = await service.findRelated('src', 'requester-1');
      expect(result.map((r) => r.id)).toEqual(['allowed']);
    });

    it('returns results sorted by score descending', async () => {
      mockRepo.findOne.mockResolvedValue(source);
      const candidates = [
        // score 1: within 30 days only
        makeRecord({ id: 'low', recordType: RecordType.IMAGING, createdAt: new Date('2026-01-16T00:00:00Z') }),
        // score 4: same type + within 30 days
        makeRecord({ id: 'high', recordType: RecordType.LAB_RESULT, createdAt: new Date('2026-01-16T00:00:00Z') }),
      ];
      mockRepo.find.mockResolvedValue(candidates);
      mockAccessControl.verifyAccess.mockResolvedValue(true);

      const result = await service.findRelated('src', 'patient-1');
      expect(result[0].id).toBe('high');
      expect(result[0].score).toBeGreaterThan(result[1].score);
    });

    it('excludes zero-score candidates', async () => {
      mockRepo.findOne.mockResolvedValue(source);
      const candidates = [
        makeRecord({
          id: 'zero',
          recordType: RecordType.IMAGING,
          providerId: 'other-provider',
          createdAt: new Date('2025-01-01T00:00:00Z'), // far past, no relation
        }),
      ];
      mockRepo.find.mockResolvedValue(candidates);
      mockAccessControl.verifyAccess.mockResolvedValue(true);

      const result = await service.findRelated('src', 'patient-1');
      expect(result).toEqual([]);
    });

    it('patient is always allowed to see their own records', async () => {
      mockRepo.findOne.mockResolvedValue(source);
      const candidate = makeRecord({
        id: 'own',
        patientId: 'patient-1',
        recordType: RecordType.LAB_RESULT,
        createdAt: new Date('2026-01-16T00:00:00Z'),
      });
      mockRepo.find.mockResolvedValue([candidate]);
      // verifyAccess should NOT be called for patient's own records
      mockAccessControl.verifyAccess.mockResolvedValue(false);

      const result = await service.findRelated('src', 'patient-1');
      expect(result.length).toBe(1);
      expect(mockAccessControl.verifyAccess).not.toHaveBeenCalledWith('patient-1', 'own');
    });
  });
});
