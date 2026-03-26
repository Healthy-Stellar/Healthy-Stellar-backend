import { Reflector } from '@nestjs/core';
import {
  RateLimit,
  RateLimitCategory,
  AuthRateLimit,
  ReadRateLimit,
  WriteRateLimit,
  AdminRateLimit,
  THROTTLER_LIMIT,
  THROTTLER_TTL,
  THROTTLER_CATEGORY,
} from './throttler.decorator';

describe('Throttler Decorators', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('RateLimit', () => {
    it('should set custom limit and ttl metadata', () => {
      class TestController {
        @RateLimit(10, 30)
        testMethod() {}
      }

      const limit = reflector.get(THROTTLER_LIMIT, TestController.prototype.testMethod);
      const ttl = reflector.get(THROTTLER_TTL, TestController.prototype.testMethod);

      expect(limit).toBe(10);
      expect(ttl).toBe(30000); // Converted to milliseconds
    });

    it('should use default ttl of 60 seconds', () => {
      class TestController {
        @RateLimit(15)
        testMethod() {}
      }

      const ttl = reflector.get(THROTTLER_TTL, TestController.prototype.testMethod);
      expect(ttl).toBe(60000);
    });
  });

  describe('RateLimitCategory', () => {
    it('should set category metadata', () => {
      class TestController {
        @RateLimitCategory('auth')
        testMethod() {}
      }

      const category = reflector.get(THROTTLER_CATEGORY, TestController.prototype.testMethod);
      expect(category).toBe('auth');
    });
  });

  describe('AuthRateLimit', () => {
    it('should set auth category with 5 req/min', () => {
      class TestController {
        @AuthRateLimit()
        login() {}
      }

      const limit = reflector.get(THROTTLER_LIMIT, TestController.prototype.login);
      const ttl = reflector.get(THROTTLER_TTL, TestController.prototype.login);
      const category = reflector.get(THROTTLER_CATEGORY, TestController.prototype.login);

      expect(limit).toBe(5);
      expect(ttl).toBe(60000);
      expect(category).toBe('auth');
    });
  });

  describe('ReadRateLimit', () => {
    it('should set read category with 100 req/min', () => {
      class TestController {
        @ReadRateLimit()
        getRecords() {}
      }

      const limit = reflector.get(THROTTLER_LIMIT, TestController.prototype.getRecords);
      const ttl = reflector.get(THROTTLER_TTL, TestController.prototype.getRecords);
      const category = reflector.get(THROTTLER_CATEGORY, TestController.prototype.getRecords);

      expect(limit).toBe(100);
      expect(ttl).toBe(60000);
      expect(category).toBe('read');
    });
  });

  describe('WriteRateLimit', () => {
    it('should set write category with 20 req/min', () => {
      class TestController {
        @WriteRateLimit()
        createRecord() {}
      }

      const limit = reflector.get(THROTTLER_LIMIT, TestController.prototype.createRecord);
      const ttl = reflector.get(THROTTLER_TTL, TestController.prototype.createRecord);
      const category = reflector.get(THROTTLER_CATEGORY, TestController.prototype.createRecord);

      expect(limit).toBe(20);
      expect(ttl).toBe(60000);
      expect(category).toBe('write');
    });
  });

  describe('AdminRateLimit', () => {
    it('should set admin category with 50 req/min', () => {
      class TestController {
        @AdminRateLimit()
        adminAction() {}
      }

      const limit = reflector.get(THROTTLER_LIMIT, TestController.prototype.adminAction);
      const ttl = reflector.get(THROTTLER_TTL, TestController.prototype.adminAction);
      const category = reflector.get(THROTTLER_CATEGORY, TestController.prototype.adminAction);

      expect(limit).toBe(50);
      expect(ttl).toBe(60000);
      expect(category).toBe('admin');
    });
  });

  describe('Decorator composition', () => {
    it('should allow combining decorators', () => {
      class TestController {
        @RateLimit(25, 30)
        @RateLimitCategory('write')
        customMethod() {}
      }

      const limit = reflector.get(THROTTLER_LIMIT, TestController.prototype.customMethod);
      const ttl = reflector.get(THROTTLER_TTL, TestController.prototype.customMethod);
      const category = reflector.get(THROTTLER_CATEGORY, TestController.prototype.customMethod);

      expect(limit).toBe(25);
      expect(ttl).toBe(30000);
      expect(category).toBe('write');
    });
  });
});
