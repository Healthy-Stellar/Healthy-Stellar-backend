import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ImportFingerprint, FingerprintStatus } from '../entities/import-fingerprint.entity';
import { DeduplicationService } from './deduplication.service';
import { ParsedRecord } from '../parsers/parsed-record.interface';
import { RecordType } from '../../records/dto/create-record.dto';

function makeRecord(overrides: Partial<ParsedRecord> = {}): ParsedRecord {
  return {
    patientId: 'PAT-001',
    recordType: RecordType.LAB_RESULT,
    rawPayload: 'raw|payload',
    sourceSystemId: 'SRC-001',
    recordDate: '2024-01-15',
    ...overrides,
  };
}

describe('DeduplicationService', () => {
  let service: DeduplicationService;
  const stored: ImportFingerprint[] = [];

  const repo = {
    findOne: jest.fn().mockImplementation(({ where: { fingerprint } }) =>
      Promise.resolve(stored.find((f) => f.fingerprint === fingerprint) ?? null),
    ),
    createQueryBuilder: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockImplementation(function (this: any) {
        // Capture the values passed via .values() call chain
        return Promise.resolve({});
      }),
    }),
  };

  beforeEach(async () => {
    stored.length = 0;
    jest.clearAllMocks();

    // Re-wire execute to actually push to `stored`
    let pendingValues: Partial<ImportFingerprint> | null = null;
    repo.createQueryBuilder.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockImplementation(function (v: any) { pendingValues = v; return this; }),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockImplementation(() => {
        if (pendingValues && !stored.some((f) => f.fingerprint === (pendingValues as any).fingerprint)) {
          stored.push({ id: 'fp-' + stored.length, createdAt: new Date(), ...pendingValues } as ImportFingerprint);
        }
        pendingValues = null;
        return Promise.resolve({});
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeduplicationService,
        { provide: getRepositoryToken(ImportFingerprint), useValue: repo },
      ],
    }).compile();

    service = module.get(DeduplicationService);
  });

  it('computes a deterministic fingerprint for the same record', () => {
    const rec = makeRecord();
    expect(service.computeFingerprint(rec)).toBe(service.computeFingerprint(rec));
  });

  it('produces different fingerprints for different source IDs', () => {
    const a = makeRecord({ sourceSystemId: 'SRC-A' });
    const b = makeRecord({ sourceSystemId: 'SRC-B' });
    expect(service.computeFingerprint(a)).not.toBe(service.computeFingerprint(b));
  });

  it('returns isDuplicate=false for a new fingerprint', async () => {
    const result = await service.check('nonexistent-fp');
    expect(result.isDuplicate).toBe(false);
  });

  it('returns isDuplicate=true after registering a fingerprint', async () => {
    const rec = makeRecord();
    const fp = service.computeFingerprint(rec);
    await service.register(fp, 'job-1', rec.rawPayload);

    // Simulate DB returning the stored entry
    repo.findOne.mockResolvedValueOnce(stored[0]);

    const result = await service.check(fp);
    expect(result.isDuplicate).toBe(true);
    expect(result.isQuarantined).toBe(false);
  });

  it('marks quarantined fingerprint correctly', async () => {
    const rec = makeRecord({ sourceSystemId: 'SRC-Q' });
    const fp = service.computeFingerprint(rec);
    await service.quarantine(fp, 'job-2', rec.rawPayload);

    const entry = stored.find((f) => f.fingerprint === fp);
    expect(entry?.status).toBe(FingerprintStatus.QUARANTINED);

    repo.findOne.mockResolvedValueOnce(entry);
    const result = await service.check(fp);
    expect(result.isDuplicate).toBe(true);
    expect(result.isQuarantined).toBe(true);
  });
});

describe('EHR Import — no duplicates on second run', () => {
  it('running the same import twice produces no additional records', async () => {
    /**
     * Strategy: we simulate the processor logic by using a Map as the
     * in-memory fingerprint store and asserting that the second import
     * skips every record.
     */
    const fingerprintStore = new Map<string, FingerprintStatus>();

    // Simulate processing a batch of records twice
    const records: ParsedRecord[] = [
      makeRecord({ sourceSystemId: 'SRC-001', recordDate: '2024-01-01' }),
      makeRecord({ sourceSystemId: 'SRC-002', recordDate: '2024-01-02' }),
      makeRecord({ sourceSystemId: 'SRC-003', recordDate: '2024-01-03' }),
    ];

    const mockRepo = {
      findOne: jest.fn().mockImplementation(({ where: { fingerprint } }) =>
        Promise.resolve(
          fingerprintStore.has(fingerprint)
            ? { fingerprint, status: fingerprintStore.get(fingerprint) }
            : null,
        ),
      ),
      createQueryBuilder: jest.fn(),
    };

    let pendingValues: any = null;
    mockRepo.createQueryBuilder.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockImplementation((v: any) => { pendingValues = v; return { orIgnore: jest.fn().mockReturnThis(), execute: jest.fn().mockImplementation(() => { fingerprintStore.set(pendingValues.fingerprint, pendingValues.status); pendingValues = null; return Promise.resolve({}); }) }; }),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    });

    const module = await Test.createTestingModule({
      providers: [
        DeduplicationService,
        { provide: getRepositoryToken(ImportFingerprint), useValue: mockRepo },
      ],
    }).compile();

    const dedup = module.get(DeduplicationService);

    // First run — all records are new
    let firstRunCreated = 0;
    for (const rec of records) {
      const fp = dedup.computeFingerprint(rec);
      const { isDuplicate } = await dedup.check(fp);
      if (!isDuplicate) {
        await dedup.register(fp, 'job-run1', rec.rawPayload);
        firstRunCreated++;
      }
    }
    expect(firstRunCreated).toBe(3);

    // Second run — all records are duplicates
    let secondRunCreated = 0;
    let secondRunSkipped = 0;
    for (const rec of records) {
      const fp = dedup.computeFingerprint(rec);
      const { isDuplicate } = await dedup.check(fp);
      if (!isDuplicate) {
        secondRunCreated++;
      } else {
        secondRunSkipped++;
      }
    }

    expect(secondRunCreated).toBe(0);
    expect(secondRunSkipped).toBe(3);
  });
});
