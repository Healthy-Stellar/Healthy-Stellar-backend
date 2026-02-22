import { Test, TestingModule } from '@nestjs/testing';
import { StellarCacheService } from './stellar-cache.service';

describe('StellarCacheService', () => {
  let service: StellarCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StellarCacheService],
    }).compile();

    service = module.get<StellarCacheService>(StellarCacheService);
  });

  afterEach(() => {
    service.clear();
  });

  describe('get and set', () => {
    it('should return null for non-existent key', () => {
      // Act
      const result = service.get('non-existent-key');

      // Assert
      expect(result).toBeNull();
    });

    it('should store and retrieve data', () => {
      // Arrange
      const key = 'test-key';
      const data = { value: 'test-data' };

      // Act
      service.set(key, data);
      const result = service.get(key);

      // Assert
      expect(result).toEqual(data);
    });

    it('should return null for expired data', async () => {
      // Arrange
      const key = 'test-key';
      const data = { value: 'test-data' };
      
      // Mock the cache TTL to be very short for testing
      service.set(key, data);
      
      // Manually expire the cache entry
      const cacheEntry = (service as any).cache.get(key);
      cacheEntry.expiresAt = Date.now() - 1000; // Set to past

      // Act
      const result = service.get(key);

      // Assert
      expect(result).toBeNull();
    });

    it('should overwrite existing data', () => {
      // Arrange
      const key = 'test-key';
      const data1 = { value: 'first' };
      const data2 = { value: 'second' };

      // Act
      service.set(key, data1);
      service.set(key, data2);
      const result = service.get(key);

      // Assert
      expect(result).toEqual(data2);
    });
  });

  describe('clear', () => {
    it('should clear all cached data', () => {
      // Arrange
      service.set('key1', { value: 'data1' });
      service.set('key2', { value: 'data2' });
      service.set('key3', { value: 'data3' });

      // Act
      service.clear();

      // Assert
      expect(service.get('key1')).toBeNull();
      expect(service.get('key2')).toBeNull();
      expect(service.get('key3')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      // Arrange
      service.set('key1', { value: 'data1' });
      service.set('key2', { value: 'data2' });

      // Act
      const stats = service.getStats();

      // Assert
      expect(stats).toHaveProperty('size', 2);
      expect(stats).toHaveProperty('ttlMs', 30000);
    });

    it('should return zero size for empty cache', () => {
      // Act
      const stats = service.getStats();

      // Assert
      expect(stats.size).toBe(0);
    });
  });

  describe('Cache expiration', () => {
    it('should set correct expiration time', () => {
      // Arrange
      const key = 'test-key';
      const data = { value: 'test-data' };
      const beforeSet = Date.now();

      // Act
      service.set(key, data);
      const cacheEntry = (service as any).cache.get(key);
      const afterSet = Date.now();

      // Assert
      expect(cacheEntry.expiresAt).toBeGreaterThanOrEqual(beforeSet + 30000);
      expect(cacheEntry.expiresAt).toBeLessThanOrEqual(afterSet + 30000);
    });

    it('should remove expired entries on get', () => {
      // Arrange
      const key = 'test-key';
      const data = { value: 'test-data' };
      service.set(key, data);
      
      // Manually expire the entry
      const cacheEntry = (service as any).cache.get(key);
      cacheEntry.expiresAt = Date.now() - 1;

      // Act
      const result = service.get(key);
      const stats = service.getStats();

      // Assert
      expect(result).toBeNull();
      expect(stats.size).toBe(0); // Entry should be removed
    });
  });
});
