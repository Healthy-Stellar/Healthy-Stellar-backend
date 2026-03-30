import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StellarTransactionProcessor } from './stellar-transaction.processor';
import { StellarContractService } from '../../blockchain/stellar-contract.service';
import { JOB_TYPES } from '../queue.constants';

// ---------------------------------------------------------------------------
// Redis mock
// ---------------------------------------------------------------------------
const redisStore: Record<string, string> = {};
const mockRedis = {
  get: jest.fn((key: string) => Promise.resolve(redisStore[key] ?? null)),
  set: jest.fn((key: string, value: string) => {
    redisStore[key] = value;
    return Promise.resolve('OK');
  }),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeJob = (overrides: Partial<any> = {}): any => ({
  id: 'job-1',
  attemptsMade: 0,
  progress: jest.fn(),
  data: {
    operationType: JOB_TYPES.ANCHOR_RECORD,
    params: { patientId: 'p1', cid: 'cid1' },
    initiatedBy: 'user-1',
    correlationId: 'corr-123',
    traceContext: null,
  },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
describe('StellarTransactionProcessor', () => {
  let processor: StellarTransactionProcessor;
  let stellarContractService: jest.Mocked<StellarContractService>;

  beforeEach(async () => {
    // Clear Redis store and mocks between tests
    Object.keys(redisStore).forEach((k) => delete redisStore[k]);
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarTransactionProcessor,
        {
          provide: StellarContractService,
          useValue: {
            anchorRecord: jest.fn().mockResolvedValue({ txHash: 'tx-abc' }),
            grantAccess: jest.fn().mockResolvedValue({ txHash: 'tx-def' }),
            revokeAccess: jest.fn().mockResolvedValue({ txHash: 'tx-ghi' }),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    processor = module.get<StellarTransactionProcessor>(StellarTransactionProcessor);
    stellarContractService = module.get(StellarContractService);

    // Trigger onModuleInit so the Redis instance is created
    processor.onModuleInit();
  });

  afterEach(() => processor.onModuleDestroy());

  // -------------------------------------------------------------------------
  // Happy-path tests (unchanged behaviour)
  // -------------------------------------------------------------------------
  it('processes anchorRecord and returns anchored status', async () => {
    const result = await processor.process(makeJob());
    expect(result.status).toBe('anchored');
    expect(result.txHash).toBe('tx-abc');
  });

  it('processes grantAccess and returns access_granted status', async () => {
    const result = await processor.process(
      makeJob({ data: { operationType: JOB_TYPES.GRANT_ACCESS, params: { patientId: 'p1', granteeId: 'g1', recordId: 'r1' }, initiatedBy: 'user-1', correlationId: 'corr-456', traceContext: null } }),
    );
    expect(result.status).toBe('access_granted');
  });

  it('processes revokeAccess and returns access_revoked status', async () => {
    const result = await processor.process(
      makeJob({ data: { operationType: JOB_TYPES.REVOKE_ACCESS, params: { patientId: 'p1', granteeId: 'g1', recordId: 'r1' }, initiatedBy: 'user-1', correlationId: 'corr-789', traceContext: null } }),
    );
    expect(result.status).toBe('access_revoked');
  });

  it('throws for unknown operation type', async () => {
    await expect(
      processor.process(makeJob({ data: { operationType: 'unknown', params: {}, initiatedBy: 'u', correlationId: 'c', traceContext: null } })),
    ).rejects.toThrow('Unknown operation type: unknown');
  });

  // -------------------------------------------------------------------------
  // Idempotency / retry tests
  // -------------------------------------------------------------------------
  it('writes result to Redis after a successful submission', async () => {
    await processor.process(makeJob());
    expect(mockRedis.set).toHaveBeenCalledWith(
      'stellar:idempotency:corr-123',
      expect.any(String),
      'EX',
      86400,
    );
  });

  it('returns cached result on retry without re-submitting to Stellar', async () => {
    // First run — succeeds and populates cache
    const firstResult = await processor.process(makeJob());
    expect(stellarContractService.anchorRecord).toHaveBeenCalledTimes(1);

    // Simulate mid-job crash: cache is populated but BullMQ retries the job
    const retryResult = await processor.process(makeJob({ id: 'job-1-retry', attemptsMade: 1 }));

    // Should return the same result without calling Stellar again
    expect(stellarContractService.anchorRecord).toHaveBeenCalledTimes(1);
    expect(retryResult).toEqual(firstResult);
  });

  it('uses deterministic jobId equal to correlationId (BullMQ deduplication)', async () => {
    // The queue service sets jobId = correlationId; verify the processor
    // reads correlationId from job.data (not job.id) for the idempotency key
    // so that even a re-enqueued job with a different BullMQ id is deduplicated.
    const cachedResult = { txHash: 'tx-cached', status: 'anchored', fromCache: true };
    redisStore['stellar:idempotency:corr-123'] = JSON.stringify(cachedResult);

    const result = await processor.process(makeJob({ id: 'different-bullmq-id' }));

    expect(stellarContractService.anchorRecord).not.toHaveBeenCalled();
    expect(result).toEqual(cachedResult);
  });
});
