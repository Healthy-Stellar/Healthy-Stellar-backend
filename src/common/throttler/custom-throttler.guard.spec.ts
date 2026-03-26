import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { THROTTLER_LIMIT, THROTTLER_TTL, THROTTLER_CATEGORY } from './throttler.decorator';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;
  let reflector: Reflector;
  let storageService: any;
  let mockContext: ExecutionContext;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    reflector = new Reflector();
    storageService = {
      increment: jest.fn(),
    };

    guard = new CustomThrottlerGuard({}, storageService, reflector);

    mockRequest = {
      user: null,
      ip: '127.0.0.1',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: () => ({ name: 'testMethod' }),
      getClass: () => ({ name: 'TestController' }),
    } as any;
  });

  describe('IP extraction', () => {
    it('should extract IP from x-forwarded-for header', async () => {
      mockRequest.headers['x-forwarded-for'] = '192.168.1.1, 10.0.0.1';
      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.stringContaining('ip:192.168.1.1'),
        expect.any(Number),
      );
    });

    it('should extract IP from x-real-ip header', async () => {
      mockRequest.headers['x-real-ip'] = '192.168.1.2';
      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.stringContaining('ip:192.168.1.2'),
        expect.any(Number),
      );
    });

    it('should fallback to req.ip', async () => {
      mockRequest.ip = '192.168.1.3';
      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.stringContaining('ip:192.168.1.3'),
        expect.any(Number),
      );
    });
  });

  describe('Tracker key generation', () => {
    it('should use IP for unauthenticated requests', async () => {
      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.stringContaining('ip:127.0.0.1'),
        expect.any(Number),
      );
    });

    it('should use user ID for authenticated requests', async () => {
      mockRequest.user = { userId: 'user123' };
      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.stringContaining('user:user123'),
        expect.any(Number),
      );
    });

    it('should use user.id if userId not available', async () => {
      mockRequest.user = { id: 'user456' };
      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.stringContaining('user:user456'),
        expect.any(Number),
      );
    });
  });

  describe('Rate limit categories', () => {
    it('should apply auth category limits (5 req/min)', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === THROTTLER_CATEGORY) return 'auth';
        return undefined;
      });

      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Category', 'auth');
    });

    it('should apply read category limits (100 req/min for authenticated)', async () => {
      mockRequest.user = { userId: 'user123' };
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === THROTTLER_CATEGORY) return 'read';
        return undefined;
      });

      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Category', 'read');
    });

    it('should apply write category limits (20 req/min for authenticated)', async () => {
      mockRequest.user = { userId: 'user123' };
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === THROTTLER_CATEGORY) return 'write';
        return undefined;
      });

      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 20);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Category', 'write');
    });

    it('should apply admin category limits (50 req/min)', async () => {
      mockRequest.user = { userId: 'admin123' };
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === THROTTLER_CATEGORY) return 'admin';
        return undefined;
      });

      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 50);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Category', 'admin');
    });

    it('should apply lower limits for unauthenticated read requests', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === THROTTLER_CATEGORY) return 'read';
        return undefined;
      });

      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 50);
    });
  });

  describe('Custom limits', () => {
    it('should use custom limits when provided', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === THROTTLER_LIMIT) return 10;
        if (key === THROTTLER_TTL) return 30000;
        return undefined;
      });

      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 30000 });

      await guard.handleRequest(mockContext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(storageService.increment).toHaveBeenCalledWith(expect.any(String), 30000);
    });
  });

  describe('Rate limit headers', () => {
    it('should set correct rate limit headers', async () => {
      storageService.increment.mockResolvedValue({ totalHits: 5, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        expect.any(Number),
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Category',
        expect.any(String),
      );
    });

    it('should calculate remaining requests correctly', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === THROTTLER_LIMIT) return 10;
        if (key === THROTTLER_TTL) return 60000;
        return undefined;
      });

      storageService.increment.mockResolvedValue({ totalHits: 3, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 7);
    });
  });

  describe('Rate limit exceeded', () => {
    it('should throw ThrottlerException when limit exceeded', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === THROTTLER_LIMIT) return 5;
        if (key === THROTTLER_TTL) return 60000;
        return undefined;
      });

      storageService.increment.mockResolvedValue({ totalHits: 6, timeToExpire: 45000 });

      await expect(guard.handleRequest(mockContext)).rejects.toThrow(ThrottlerException);
    });

    it('should set Retry-After header when limit exceeded', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === THROTTLER_LIMIT) return 5;
        if (key === THROTTLER_TTL) return 60000;
        return undefined;
      });

      storageService.increment.mockResolvedValue({ totalHits: 6, timeToExpire: 45000 });

      try {
        await guard.handleRequest(mockContext);
      } catch (error) {
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', 45);
      }
    });

    it('should include category in error message', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === THROTTLER_CATEGORY) return 'auth';
        if (key === THROTTLER_LIMIT) return 5;
        if (key === THROTTLER_TTL) return 60000;
        return undefined;
      });

      storageService.increment.mockResolvedValue({ totalHits: 6, timeToExpire: 30000 });

      await expect(guard.handleRequest(mockContext)).rejects.toThrow(/auth endpoints/);
    });
  });

  describe('Storage key generation', () => {
    it('should generate unique keys per category', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === THROTTLER_CATEGORY) return 'write';
        return undefined;
      });

      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.stringContaining('throttle:write:'),
        expect.any(Number),
      );
    });

    it('should include controller and method name in key', async () => {
      storageService.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });

      await guard.handleRequest(mockContext);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.stringContaining('TestController:testMethod'),
        expect.any(Number),
      );
    });
  });
});
