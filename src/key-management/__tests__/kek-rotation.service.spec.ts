import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  KekRotationService,
  KEK_ROTATION_LOCK_KEY,
  DEFAULT_KEK_ROTATION_LOCK_TTL_MS,
} from '../services/kek-rotation.service';
import { EnvelopeKeyManagementService } from '../services/envelope-key-management.service';
import { RedisLockService } from '../../common/utils/redis-lock.service';

describe('KekRotationService', () => {
  let service: KekRotationService;
  let keyManagement: jest.Mocked<Partial<EnvelopeKeyManagementService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;
  let redisLock: jest.Mocked<Partial<RedisLockService>>;

  beforeEach(async () => {
    keyManagement = { rotateMasterKey: jest.fn().mockResolvedValue({ reencryptedCount: 5 }) };
    // get(key, default): return the default for anything but the interval, so
    // the lock TTL resolves normally and KEK_ROTATION_INTERVAL_DAYS stays 90.
    configService = {
      get: jest.fn((key: string, fallback?: unknown) =>
        key === 'KEK_ROTATION_INTERVAL_DAYS' ? 90 : fallback,
      ),
    };
    redisLock = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        KekRotationService,
        { provide: EnvelopeKeyManagementService, useValue: keyManagement },
        { provide: ConfigService, useValue: configService },
        { provide: RedisLockService, useValue: redisLock },
      ],
    }).compile();
    service = module.get(KekRotationService);
  });

  it('rotates and records result', async () => {
    const result = await service.rotate('operator-1');
    expect(result.reencryptedCount).toBe(5);
    const status = service.getStatus();
    expect(status.lastRotatedAt).toBeDefined();
    expect(status.inProgress).toBe(false);
    expect(status.lastResult?.reencryptedCount).toBe(5);
  });

  it('throws when rotation already in progress', async () => {
    // Simulate in-progress by making rotateMasterKey never resolve during test
    let resolve: () => void;
    keyManagement.rotateMasterKey = jest.fn(
      () => new Promise<any>(r => { resolve = () => r({ reencryptedCount: 0 }); }),
    );
    const p = service.rotate('op1');
    await expect(service.rotate('op2')).rejects.toThrow('already in progress');
    resolve!();
    await p;
  });

  it('scheduledRotation skips if interval has not elapsed', async () => {
    // Set lastRotatedAt to now — interval (90 days) hasn't elapsed
    (service as any).lastRotatedAt = new Date();
    await service.scheduledRotation();
    expect(keyManagement.rotateMasterKey).not.toHaveBeenCalled();
  });

  it('scheduledRotation rotates if interval elapsed', async () => {
    // Set lastRotatedAt to 91 days ago
    const past = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    (service as any).lastRotatedAt = past;
    await service.scheduledRotation();
    expect(keyManagement.rotateMasterKey).toHaveBeenCalled();
  });
});

describe('KekRotationService - distributed lock (#952)', () => {
  let service: KekRotationService;
  let keyManagement: jest.Mocked<Partial<EnvelopeKeyManagementService>>;
  let redisLock: jest.Mocked<Partial<RedisLockService>>;

  async function build(acquired = true, ttlOverride?: number) {
    keyManagement = { rotateMasterKey: jest.fn().mockResolvedValue({ reencryptedCount: 5 }) };
    redisLock = {
      acquireLock: jest.fn().mockResolvedValue(acquired),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'KEK_ROTATION_INTERVAL_DAYS') return 90;
        if (key === 'KEK_ROTATION_LOCK_TTL_MS' && ttlOverride !== undefined) return ttlOverride;
        return fallback;
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        KekRotationService,
        { provide: EnvelopeKeyManagementService, useValue: keyManagement },
        { provide: ConfigService, useValue: configService },
        { provide: RedisLockService, useValue: redisLock },
      ],
    }).compile();
    service = module.get(KekRotationService);
  }

  it('takes the lock before rotating', async () => {
    await build();
    await service.rotate('operator-1');
    expect(redisLock.acquireLock).toHaveBeenCalledWith(
      KEK_ROTATION_LOCK_KEY,
      DEFAULT_KEK_ROTATION_LOCK_TTL_MS,
    );
  });

  it('honours a configured lock TTL', async () => {
    await build(true, 60000);
    await service.rotate('operator-1');
    expect(redisLock.acquireLock).toHaveBeenCalledWith(KEK_ROTATION_LOCK_KEY, 60000);
  });

  it('does not rotate when another instance holds the lock', async () => {
    await build(false);
    await expect(service.rotate('operator-1')).rejects.toThrow('already in progress');
    expect(keyManagement.rotateMasterKey).not.toHaveBeenCalled();
  });

  it('does not release a lock it never acquired', async () => {
    await build(false);
    await expect(service.rotate('operator-1')).rejects.toThrow('already in progress');
    expect(redisLock.releaseLock).not.toHaveBeenCalled();
  });

  it('releases the lock after a successful rotation', async () => {
    await build();
    await service.rotate('operator-1');
    expect(redisLock.releaseLock).toHaveBeenCalledWith(KEK_ROTATION_LOCK_KEY);
  });

  it('releases the lock when rotation throws', async () => {
    await build();
    keyManagement.rotateMasterKey = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(service.rotate('operator-1')).rejects.toThrow('boom');
    expect(redisLock.releaseLock).toHaveBeenCalledWith(KEK_ROTATION_LOCK_KEY);
  });

  it('clears inProgress when rotation throws, so the instance is not wedged', async () => {
    await build();
    keyManagement.rotateMasterKey = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(service.rotate('operator-1')).rejects.toThrow('boom');
    expect(service.getStatus().inProgress).toBe(false);
  });

  it('scheduledRotation swallows a lost lock rather than surfacing an error', async () => {
    await build(false);
    (service as any).lastRotatedAt = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    await expect(service.scheduledRotation()).resolves.toBeUndefined();
    expect(keyManagement.rotateMasterKey).not.toHaveBeenCalled();
  });

  it('scheduledRotation still propagates a real rotation failure', async () => {
    await build();
    keyManagement.rotateMasterKey = jest.fn().mockRejectedValue(new Error('kms unavailable'));
    (service as any).lastRotatedAt = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    await expect(service.scheduledRotation()).rejects.toThrow('kms unavailable');
  });

  it('short-circuits locally without a Redis round-trip when already in progress', async () => {
    await build();
    let resolve: () => void;
    keyManagement.rotateMasterKey = jest.fn(
      () => new Promise<any>((r) => { resolve = () => r({ reencryptedCount: 0 }); }),
    );
    const inFlight = service.rotate('op1');
    await expect(service.rotate('op2')).rejects.toThrow('already in progress');
    expect(redisLock.acquireLock).toHaveBeenCalledTimes(1);
    resolve!();
    await inFlight;
  });
});
