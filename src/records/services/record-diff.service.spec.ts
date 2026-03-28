import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RecordDiffService } from './record-diff.service';
import { Record } from '../entities/record.entity';
import { RecordVersion } from '../entities/record-version.entity';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { RecordType } from '../dto/create-record.dto';

// ── Redis mock — in-memory store ──────────────────────────────────────────────

const redisStore: Record<string, string> = {};
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockImplementation((key: string) => Promise.resolve(redisStore[key] ?? null)),
    set: jest.fn().mockImplementation((key: string, value: string) => {
      redisStore[key] = value;
      return Promise.resolve('OK');
    }),
    disconnect: jest.fn(),
  }));
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PATIENT_ID = 'patient-001';
const RECORD_ID = 'record-001';
const OTHER_USER = 'other-user-999';

const BASE_RECORD: Partial<Record> = {
  id: RECORD_ID,
  patientId: PATIENT_ID,
  cid: 'Qm-cid-v3',
  isDeleted: false,
  recordType: RecordType.LAB_RESULT,
  description: 'Lipid panel',
  createdAt: new Date('2024-01-01T00:00:00Z'),
};

function makeVersion(overrides: Partial<RecordVersion> = {}): RecordVersion {
  return {
    id: 'ver-001',
    recordId: RECORD_ID,
    version: 1,
    cid: 'Qm-cid-v1',
    encryptedDek: null,
    stellarTxHash: 'stellar-tx-v1',
    amendedBy: PATIENT_ID,
    amendmentReason: 'Initial upload',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

const V1 = makeVersion();
const V2 = makeVersion({
  id: 'ver-002',
  version: 2,
  cid: 'Qm-cid-v2',
  stellarTxHash: 'stellar-tx-v2',
  amendedBy: PATIENT_ID,
  amendmentReason: 'Corrected LDL value after instrument recalibration',
  createdAt: new Date('2024-02-01T00:00:00Z'),
});
const V3 = makeVersion({
  id: 'ver-003',
  version: 3,
  cid: 'Qm-cid-v3',
  stellarTxHash: null, // anchoring failed — field removed
  amendedBy: PATIENT_ID,
  amendmentReason: 'Added physician notes to the lab report document',
  createdAt: new Date('2024-03-01T00:00:00Z'),
});

// ── Mock factories ─────────────────────────────────────────────────────────────

function makeMocks() {
  const recordRepo = {
    findOne: jest.fn().mockResolvedValue(BASE_RECORD),
  };

  const versionRepo = {
    findOne: jest.fn(),
  };

  const accessControl = {
    verifyAccess: jest.fn().mockResolvedValue(true),
    findActiveEmergencyGrant: jest.fn().mockResolvedValue(null),
  };

  const configService = {
    get: jest.fn().mockImplementation((key: string, defaultVal?: any) => defaultVal),
  };

  return { recordRepo, versionRepo, accessControl, configService };
}

async function buildModule(mocks: ReturnType<typeof makeMocks>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RecordDiffService,
      { provide: getRepositoryToken(Record), useValue: mocks.recordRepo },
      { provide: getRepositoryToken(RecordVersion), useValue: mocks.versionRepo },
      { provide: AccessControlService, useValue: mocks.accessControl },
      { provide: ConfigService, useValue: mocks.configService },
    ],
  }).compile();

  const svc = module.get<RecordDiffService>(RecordDiffService);
  // Manually call onModuleInit so the Redis mock is wired up
  await svc.onModuleInit();
  return svc;
}

// ── Test suites ────────────────────────────────────────────────────────────────

describe('RecordDiffService', () => {
  let service: RecordDiffService;
  let mocks: ReturnType<typeof makeMocks>;

  beforeEach(async () => {
    // Clear the in-memory redis store before each test
    Object.keys(redisStore).forEach((k) => delete redisStore[k]);
    mocks = makeMocks();
    service = await buildModule(mocks);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  // ── field modified ───────────────────────────────────────────────────────────

  it('detects a modified field (amendmentReason changes v1→v2)', async () => {
    mocks.versionRepo.findOne
      .mockResolvedValueOnce(V1)  // from
      .mockResolvedValueOnce(V2); // to

    const result = await service.computeDiff(RECORD_ID, 1, 2, PATIENT_ID);

    const change = result.changes.find((c) => c.field === 'amendmentReason');
    expect(change).toBeDefined();
    expect(change!.changeType).toBe('modified');
    expect(change!.oldValue).toBe(V1.amendmentReason);
    expect(change!.newValue).toBe(V2.amendmentReason);
  });

  // ── field removed ────────────────────────────────────────────────────────────

  it('detects a removed field when stellarTxHash drops to null (v2→v3)', async () => {
    mocks.versionRepo.findOne
      .mockResolvedValueOnce(V2)  // from
      .mockResolvedValueOnce(V3); // to

    const result = await service.computeDiff(RECORD_ID, 2, 3, PATIENT_ID);

    const change = result.changes.find((c) => c.field === 'stellarTxHash');
    expect(change).toBeDefined();
    expect(change!.changeType).toBe('removed');
    expect(change!.oldValue).toBe('stellar-tx-v2');
    expect(change!.newValue).toBeNull();
  });

  // ── field added ──────────────────────────────────────────────────────────────

  it('detects an added field when stellarTxHash goes from null to a value', async () => {
    const noHash = makeVersion({ stellarTxHash: null, version: 1 });
    const withHash = makeVersion({ stellarTxHash: 'new-hash', version: 2, cid: 'Qm-cid-v2' });

    mocks.versionRepo.findOne
      .mockResolvedValueOnce(noHash)
      .mockResolvedValueOnce(withHash);

    const result = await service.computeDiff(RECORD_ID, 1, 2, PATIENT_ID);

    const change = result.changes.find((c) => c.field === 'stellarTxHash');
    expect(change).toBeDefined();
    expect(change!.changeType).toBe('added');
    expect(change!.newValue).toBe('new-hash');
  });

  // ── binary content changed flag ──────────────────────────────────────────────

  it('flags binaryContentChanged=true when CID differs', async () => {
    mocks.versionRepo.findOne
      .mockResolvedValueOnce(V1)
      .mockResolvedValueOnce(V2);

    const result = await service.computeDiff(RECORD_ID, 1, 2, PATIENT_ID);
    expect(result.binaryContentChanged).toBe(true);
  });

  it('flags binaryContentChanged=false when CID is identical', async () => {
    const sameCid = makeVersion({ version: 2, cid: V1.cid }); // same cid as v1

    mocks.versionRepo.findOne
      .mockResolvedValueOnce(V1)
      .mockResolvedValueOnce(sameCid);

    const result = await service.computeDiff(RECORD_ID, 1, 2, PATIENT_ID);
    expect(result.binaryContentChanged).toBe(false);
  });

  // ── non-sequential comparison ────────────────────────────────────────────────

  it('supports non-sequential comparison (from=1 to=3)', async () => {
    mocks.versionRepo.findOne
      .mockResolvedValueOnce(V1)
      .mockResolvedValueOnce(V3);

    const result = await service.computeDiff(RECORD_ID, 1, 3, PATIENT_ID);

    expect(result.fromVersion).toBe(1);
    expect(result.toVersion).toBe(3);
    expect(result.binaryContentChanged).toBe(true); // V1.cid !== V3.cid
  });

  // ── Redis caching ────────────────────────────────────────────────────────────

  it('caches result in Redis and returns cached value on repeat call', async () => {
    mocks.versionRepo.findOne
      .mockResolvedValueOnce(V1)
      .mockResolvedValueOnce(V2);

    // First call — populates cache
    const first = await service.computeDiff(RECORD_ID, 1, 2, PATIENT_ID);

    // Second call — should hit cache, NOT call versionRepo again
    const second = await service.computeDiff(RECORD_ID, 1, 2, PATIENT_ID);

    // versionRepo should only have been called once (for the first call)
    expect(mocks.versionRepo.findOne).toHaveBeenCalledTimes(2);
    expect(first).toEqual(second);
  });

  // ── Access control ───────────────────────────────────────────────────────────

  it('throws ForbiddenException when requester has no access', async () => {
    mocks.accessControl.verifyAccess.mockResolvedValue(false);
    mocks.accessControl.findActiveEmergencyGrant.mockResolvedValue(null);

    await expect(service.computeDiff(RECORD_ID, 1, 2, OTHER_USER)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws NotFoundException when from version is missing', async () => {
    mocks.versionRepo.findOne
      .mockResolvedValueOnce(null) // from not found
      .mockResolvedValueOnce(V2);

    await expect(service.computeDiff(RECORD_ID, 99, 2, PATIENT_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when to version is missing', async () => {
    mocks.versionRepo.findOne
      .mockResolvedValueOnce(V1)
      .mockResolvedValueOnce(null); // to not found

    await expect(service.computeDiff(RECORD_ID, 1, 99, PATIENT_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when record does not exist', async () => {
    mocks.recordRepo.findOne.mockResolvedValue(null);

    await expect(service.computeDiff('no-such-record', 1, 2, PATIENT_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── Response shape ───────────────────────────────────────────────────────────

  it('response includes amendedBy, amendmentReason, and amendedAt from the "to" version', async () => {
    mocks.versionRepo.findOne
      .mockResolvedValueOnce(V1)
      .mockResolvedValueOnce(V2);

    const result = await service.computeDiff(RECORD_ID, 1, 2, PATIENT_ID);

    expect(result.amendedBy).toBe(V2.amendedBy);
    expect(result.amendmentReason).toBe(V2.amendmentReason);
    expect(result.amendedAt).toBe(V2.createdAt.toISOString());
  });
});
