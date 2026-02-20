import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RateLimitingService } from '../rate-limiting.service';

describe('RateLimitingService', () => {
  let service: RateLimitingService;

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitingService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<RateLimitingService>(RateLimitingService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('check - basic rate limiting', () => {
    it('should allow requests under the limit', () => {
      const result = service.check('test-key', { windowMs: 60_000, maxRequests: 5 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should deny requests over the limit', () => {
      const config = { windowMs: 60_000, maxRequests: 3 };
      service.check('key', config);
      service.check('key', config);
      service.check('key', config);
      const result = service.check('key', config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', () => {
      const config = { windowMs: 60_000, maxRequests: 2 };
      service.check('key', config);
      service.check('key', config);
      const blocked = service.check('key', config);
      expect(blocked.allowed).toBe(false);

      // Advance time past the window
      jest.advanceTimersByTime(61_000);
      const allowed = service.check('key', config);
      expect(allowed.allowed).toBe(true);
    });

    it('should block when blockDurationMs is set and limit exceeded', () => {
      const config = { windowMs: 60_000, maxRequests: 1, blockDurationMs: 300_000 };
      service.check('key', config); // allowed
      service.check('key', config); // exceeded - now blocked

      const result = service.check('key', config);
      expect(result.blocked).toBe(true);
    });

    it('should keep blocked after window reset during block period', () => {
      const config = { windowMs: 1_000, maxRequests: 1, blockDurationMs: 300_000 };
      service.check('key', config); // allowed
      service.check('key', config); // exceeded - blocked

      jest.advanceTimersByTime(2_000); // past window, still within block period
      const result = service.check('key', config);
      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(true);
    });
  });

  describe('profile-based rate limiting', () => {
    it('should use AUTH profile limits for auth endpoints', () => {
      const profile = service.PROFILES['AUTH'];
      expect(profile.maxRequests).toBeLessThanOrEqual(10);
      expect(profile.blockDurationMs).toBeDefined();
    });

    it('should use PHI_ACCESS profile limits', () => {
      const profile = service.PROFILES['PHI_ACCESS'];
      expect(profile.maxRequests).toBeLessThanOrEqual(50);
      expect(profile.windowMs).toBeLessThanOrEqual(60_000);
    });

    it('should allow more requests for DEVICE_TELEMETRY', () => {
      const telemetry = service.PROFILES['DEVICE_TELEMETRY'];
      const auth = service.PROFILES['AUTH'];
      expect(telemetry.maxRequests).toBeGreaterThan(auth.maxRequests);
    });

    it('should check named profile', () => {
      const result = service.check('user:1.2.3.4:PHI_ACCESS', 'PHI_ACCESS');
      expect(result).toBeDefined();
      expect(result.allowed).toBe(true);
    });

    it('should throw for unknown profile', () => {
      expect(() => service.check('key', 'UNKNOWN_PROFILE')).toThrow();
    });
  });

  describe('buildKey', () => {
    it('should build a composite key from IP, userId, endpoint', () => {
      const key = service.buildKey('1.2.3.4', 'user-1', 'PHI_ACCESS');
      expect(key).toBe('1.2.3.4:user-1:PHI_ACCESS');
    });

    it('should use anonymous for missing userId', () => {
      const key = service.buildKey('1.2.3.4');
      expect(key).toContain('anonymous');
    });
  });

  describe('checkIpLimit', () => {
    it('should allow requests under IP ceiling', () => {
      const result = service.checkIpLimit('1.2.3.4');
      expect(result.allowed).toBe(true);
    });
  });

  describe('isBlocked', () => {
    it('should return false for unknown key', () => {
      expect(service.isBlocked('unknown-key')).toBe(false);
    });

    it('should return true for blocked key', () => {
      const config = { windowMs: 60_000, maxRequests: 1, blockDurationMs: 300_000 };
      service.check('blocked-key', config);
      service.check('blocked-key', config);

      expect(service.isBlocked('blocked-key')).toBe(true);
    });
  });

  describe('unblock', () => {
    it('should unblock a blocked key', () => {
      const config = { windowMs: 60_000, maxRequests: 1, blockDurationMs: 300_000 };
      service.check('key', config);
      service.check('key', config);

      expect(service.isBlocked('key')).toBe(true);
      service.unblock('key');
      expect(service.isBlocked('key')).toBe(false);
    });

    it('should reset count when unblocking', () => {
      const config = { windowMs: 60_000, maxRequests: 1, blockDurationMs: 300_000 };
      service.check('key', config);
      service.check('key', config);
      service.unblock('key');

      const result = service.check('key', config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return current status without modifying count', () => {
      const status1 = service.getStatus('new-key', 'API_GENERAL');
      const status2 = service.getStatus('new-key', 'API_GENERAL');
      expect(status1.remaining).toBe(status2.remaining);
    });
  });

  describe('independent keys', () => {
    it('should track different keys independently', () => {
      const config = { windowMs: 60_000, maxRequests: 2 };

      service.check('key-a', config);
      service.check('key-a', config);
      const blockedA = service.check('key-a', config);

      const allowedB = service.check('key-b', config);

      expect(blockedA.allowed).toBe(false);
      expect(allowedB.allowed).toBe(true);
    });
  });
});
