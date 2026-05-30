/**
 * test/auth/redis-lock.service.spec.ts
 *
 * Covers:
 *  1. Lock acquired when key does not exist (SET NX returns OK).
 *  2. Lock denied when key already exists (SET NX returns null).
 *  3. Release calls the Lua script with the correct token.
 *  4. Release is a no-op when the Lua script returns 0 (lock stolen).
 *  5. Release swallows Redis errors gracefully.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRedisToken } from '@nestjs-modules/ioredis';
import { RedisLockService } from '../../src/auth/redis-lock.service';

const LOCK_KEY = 'lock:test-resource';
const LOCK_TTL = 5_000;

function buildRedisMock() {
  return {
    set: jest.fn(),
    eval: jest.fn(),
  };
}

describe('RedisLockService', () => {
  let service: RedisLockService;
  let redisMock: ReturnType<typeof buildRedisMock>;

  beforeEach(async () => {
    redisMock = buildRedisMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisLockService,
        { provide: getRedisToken('default'), useValue: redisMock },
      ],
    }).compile();

    service = module.get<RedisLockService>(RedisLockService);
  });

  // -------------------------------------------------------------------------
  // 1. Lock acquired
  // -------------------------------------------------------------------------
  describe('acquire — success', () => {
    beforeEach(() => redisMock.set.mockResolvedValue('OK'));

    it('calls SET with NX and PX options', async () => {
      await service.acquire(LOCK_KEY, LOCK_TTL);
      expect(redisMock.set).toHaveBeenCalledWith(
        LOCK_KEY,
        expect.any(String),
        'NX',
        'PX',
        LOCK_TTL,
      );
    });

    it('returns a non-null LockHandle', async () => {
      const handle = await service.acquire(LOCK_KEY, LOCK_TTL);
      expect(handle).not.toBeNull();
      expect(typeof handle!.release).toBe('function');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Lock denied
  // -------------------------------------------------------------------------
  describe('acquire — denied', () => {
    beforeEach(() => redisMock.set.mockResolvedValue(null));

    it('returns null when lock is already held', async () => {
      const handle = await service.acquire(LOCK_KEY, LOCK_TTL);
      expect(handle).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Release — happy path
  // -------------------------------------------------------------------------
  describe('release — lock owned', () => {
    beforeEach(() => {
      redisMock.set.mockResolvedValue('OK');
      redisMock.eval.mockResolvedValue(1); // Lua script deleted the key
    });

    it('calls eval (Lua script) with the correct key', async () => {
      const handle = await service.acquire(LOCK_KEY, LOCK_TTL);
      await handle!.release();
      expect(redisMock.eval).toHaveBeenCalledWith(
        expect.any(String), // the Lua script
        1,
        LOCK_KEY,
        expect.any(String), // the token generated at acquire time
      );
    });

    it('uses the same token that was set during acquire', async () => {
      // Capture the token passed to SET
      let capturedToken: string | undefined;
      redisMock.set.mockImplementation((_key: string, token: string) => {
        capturedToken = token;
        return Promise.resolve('OK');
      });

      const handle = await service.acquire(LOCK_KEY, LOCK_TTL);
      await handle!.release();

      // The token passed to eval must match the one passed to set
      const evalArgs = redisMock.eval.mock.calls[0];
      expect(evalArgs[3]).toBe(capturedToken);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Release — lock stolen (Lua returns 0)
  // -------------------------------------------------------------------------
  describe('release — lock stolen by TTL expiry', () => {
    beforeEach(() => {
      redisMock.set.mockResolvedValue('OK');
      redisMock.eval.mockResolvedValue(0); // key no longer belongs to us
    });

    it('does not throw when Lua returns 0', async () => {
      const handle = await service.acquire(LOCK_KEY, LOCK_TTL);
      await expect(handle!.release()).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Release — Redis error is swallowed
  // -------------------------------------------------------------------------
  describe('release — Redis error', () => {
    beforeEach(() => {
      redisMock.set.mockResolvedValue('OK');
      redisMock.eval.mockRejectedValue(new Error('Redis unavailable'));
    });

    it('swallows the error gracefully', async () => {
      const handle = await service.acquire(LOCK_KEY, LOCK_TTL);
      await expect(handle!.release()).resolves.not.toThrow();
    });
  });
});