import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { RefreshTokenStoreService } from './refresh-token-store.service';

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

// In-memory Redis mock
function buildRedisMock() {
  const store = new Map<string, { value: string; ttl: number }>();
  return {
    store,
    connect: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockImplementation((key: string, value: string, _ex: string, ttl: number) => {
      store.set(key, { value, ttl });
      return Promise.resolve('OK');
    }),
    get: jest.fn().mockImplementation((key: string) => {
      return Promise.resolve(store.get(key)?.value ?? null);
    }),
    del: jest.fn().mockImplementation((...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return Promise.resolve(keys.length);
    }),
  };
}

describe('RefreshTokenStoreService', () => {
  let service: RefreshTokenStoreService;
  let redisMock: ReturnType<typeof buildRedisMock>;

  beforeEach(async () => {
    redisMock = buildRedisMock();

    jest.resetModules();
    jest.mock('ioredis', () => jest.fn().mockImplementation(() => redisMock));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenStoreService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(RefreshTokenStoreService);
    // Force the lazy client to be the mock
    (service as any).redis = redisMock;
  });

  afterEach(() => jest.clearAllMocks());

  describe('store', () => {
    it('saves hashed token with 7-day TTL', async () => {
      await service.store('session-1', 'my-token');

      expect(redisMock.set).toHaveBeenCalledWith(
        'rt:active:session-1',
        hash('my-token'),
        'EX',
        604800,
      );
    });
  });

  describe('consumeAndValidate', () => {
    it('succeeds when token matches stored hash', async () => {
      await service.store('session-1', 'valid-token');

      await expect(service.consumeAndValidate('session-1', 'valid-token')).resolves.not.toThrow();
    });

    it('removes active key and marks token as consumed after use', async () => {
      await service.store('session-1', 'valid-token');
      await service.consumeAndValidate('session-1', 'valid-token');

      expect(redisMock.del).toHaveBeenCalledWith('rt:active:session-1');
      expect(redisMock.set).toHaveBeenCalledWith(
        `rt:consumed:${hash('valid-token')}`,
        '1',
        'EX',
        604800,
      );
    });

    it('throws UnauthorizedException when no token is stored for session', async () => {
      await expect(service.consumeAndValidate('session-1', 'any-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when token does not match stored hash', async () => {
      await service.store('session-1', 'correct-token');

      await expect(service.consumeAndValidate('session-1', 'wrong-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('detects reuse attack: throws and revokes session when consumed token is replayed', async () => {
      await service.store('session-1', 'old-token');
      // First use — legitimate rotation
      await service.consumeAndValidate('session-1', 'old-token');

      // Second use — reuse attack
      await expect(service.consumeAndValidate('session-1', 'old-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token reuse detected — session revoked'),
      );

      // Active key for the session should be deleted (session revoked)
      expect(redisMock.del).toHaveBeenCalledWith('rt:active:session-1');
    });
  });

  describe('revokeSession', () => {
    it('deletes the active key for the session', async () => {
      await service.store('session-1', 'some-token');
      await service.revokeSession('session-1');

      expect(redisMock.del).toHaveBeenCalledWith('rt:active:session-1');
    });
  });
});
