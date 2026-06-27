import { Test, TestingModule } from '@nestjs/testing';
import { StellarSequenceLockService } from './stellar-sequence-lock.service';
import { RedisLockService } from '../../common/utils/redis-lock.service';
import { StellarTracingService } from './stellar-tracing.service';

/**
 * In-memory stand-in for RedisLockService that behaves like a real
 * distributed lock (NX-style): only one holder per key at a time.
 */
class FakeRedisLockService {
  private locks = new Set<string>();

  async acquireLock(key: string): Promise<boolean> {
    if (this.locks.has(key)) return false;
    this.locks.add(key);
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    this.locks.delete(key);
  }
}

function buildKeypair(publicKey: string) {
  return {
    publicKey: () => publicKey,
    sign: jest.fn(),
  } as any;
}

describe('StellarSequenceLockService', () => {
  let service: StellarSequenceLockService;
  let redisLock: FakeRedisLockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarSequenceLockService,
        { provide: RedisLockService, useClass: FakeRedisLockService },
        StellarTracingService,
      ],
    }).compile();

    service = module.get(StellarSequenceLockService);
    redisLock = module.get(RedisLockService);
  });

  it('submits successfully when there is no sequence conflict', async () => {
    const sourceKeypair = buildKeypair('GABC123');
    const horizonServer = {
      loadAccount: jest.fn().mockResolvedValue({ sequenceNumber: () => '1' }),
      submitTransaction: jest.fn().mockResolvedValue({ hash: 'tx1', successful: true }),
    } as any;

    const buildTransaction = jest.fn().mockReturnValue({ sign: jest.fn() });

    const result = await service.submitWithSequenceLock(
      horizonServer,
      sourceKeypair,
      buildTransaction,
      'test.submit',
    );

    expect(result.hash).toBe('tx1');
    expect(horizonServer.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('refreshes sequence and retries exactly once on tx_bad_seq', async () => {
    const sourceKeypair = buildKeypair('GABC123');
    const badSeqError = {
      response: { data: { extras: { result_codes: { transaction: 'tx_bad_seq' } } } },
    };

    const horizonServer = {
      loadAccount: jest
        .fn()
        .mockResolvedValueOnce({ sequenceNumber: () => '1' })
        .mockResolvedValueOnce({ sequenceNumber: () => '2' }),
      submitTransaction: jest
        .fn()
        .mockRejectedValueOnce(badSeqError)
        .mockResolvedValueOnce({ hash: 'tx2', successful: true }),
    } as any;

    const buildTransaction = jest.fn().mockReturnValue({ sign: jest.fn() });

    const result = await service.submitWithSequenceLock(
      horizonServer,
      sourceKeypair,
      buildTransaction,
      'test.submit',
    );

    expect(result.hash).toBe('tx2');
    expect(horizonServer.submitTransaction).toHaveBeenCalledTimes(2);
    expect(horizonServer.loadAccount).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-sequence errors without retrying', async () => {
    const sourceKeypair = buildKeypair('GABC123');
    const horizonServer = {
      loadAccount: jest.fn().mockResolvedValue({ sequenceNumber: () => '1' }),
      submitTransaction: jest.fn().mockRejectedValue(new Error('tx_insufficient_fee')),
    } as any;

    const buildTransaction = jest.fn().mockReturnValue({ sign: jest.fn() });

    await expect(
      service.submitWithSequenceLock(horizonServer, sourceKeypair, buildTransaction, 'test.submit'),
    ).rejects.toThrow('tx_insufficient_fee');

    expect(horizonServer.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('serializes 10 concurrent submissions from the same account and all succeed', async () => {
    const sourceKeypair = buildKeypair('GABC123');
    let sequence = 0;
    let inFlight = 0;
    let maxConcurrent = 0;

    const horizonServer = {
      loadAccount: jest.fn().mockImplementation(async () => ({
        sequenceNumber: () => String(sequence),
      })),
      submitTransaction: jest.fn().mockImplementation(async () => {
        inFlight++;
        maxConcurrent = Math.max(maxConcurrent, inFlight);
        // Simulate network latency so overlapping calls would race if unlocked.
        await new Promise((resolve) => setTimeout(resolve, 5));
        sequence++;
        inFlight--;
        return { hash: `tx-${sequence}`, successful: true };
      }),
    } as any;

    const buildTransaction = jest.fn().mockReturnValue({ sign: jest.fn() });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        service.submitWithSequenceLock(horizonServer, sourceKeypair, buildTransaction, 'test.payment'),
      ),
    );

    expect(results).toHaveLength(10);
    expect(results.every((r) => r.successful)).toBe(true);
    expect(maxConcurrent).toBe(1);
    expect(horizonServer.submitTransaction).toHaveBeenCalledTimes(10);
  });
});
