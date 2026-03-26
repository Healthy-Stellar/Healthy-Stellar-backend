import { ConfigService } from '@nestjs/config';
import { ThrottlerConfigService } from './throttler.config';

describe('ThrottlerConfigService', () => {
  let service: ThrottlerConfigService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: 'test-password',
          REDIS_DB: 0,
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    service = new ThrottlerConfigService(configService);
  });

  describe('createThrottlerOptions', () => {
    it('should create throttler options with Redis storage', () => {
      const options = service.createThrottlerOptions();

      expect(options).toBeDefined();
      expect(options.storage).toBeDefined();
      expect(options.throttlers).toBeDefined();
    });

    it('should configure default throttler', () => {
      const options = service.createThrottlerOptions();
      const defaultThrottler = options.throttlers?.find((t: any) => t.name === 'default');

      expect(defaultThrottler).toBeDefined();
      expect(defaultThrottler?.ttl).toBe(60000);
      expect(defaultThrottler?.limit).toBe(100);
    });

    it('should configure auth throttler with 5 req/min', () => {
      const options = service.createThrottlerOptions();
      const authThrottler = options.throttlers?.find((t: any) => t.name === 'auth');

      expect(authThrottler).toBeDefined();
      expect(authThrottler?.ttl).toBe(60000);
      expect(authThrottler?.limit).toBe(5);
    });

    it('should configure read throttler with 100 req/min', () => {
      const options = service.createThrottlerOptions();
      const readThrottler = options.throttlers?.find((t: any) => t.name === 'read');

      expect(readThrottler).toBeDefined();
      expect(readThrottler?.ttl).toBe(60000);
      expect(readThrottler?.limit).toBe(100);
    });

    it('should configure write throttler with 20 req/min', () => {
      const options = service.createThrottlerOptions();
      const writeThrottler = options.throttlers?.find((t: any) => t.name === 'write');

      expect(writeThrottler).toBeDefined();
      expect(writeThrottler?.ttl).toBe(60000);
      expect(writeThrottler?.limit).toBe(20);
    });

    it('should configure admin throttler with 50 req/min', () => {
      const options = service.createThrottlerOptions();
      const adminThrottler = options.throttlers?.find((t: any) => t.name === 'admin');

      expect(adminThrottler).toBeDefined();
      expect(adminThrottler?.ttl).toBe(60000);
      expect(adminThrottler?.limit).toBe(50);
    });

    it('should use Redis configuration from ConfigService', () => {
      service.createThrottlerOptions();

      expect(configService.get).toHaveBeenCalledWith('REDIS_HOST', 'localhost');
      expect(configService.get).toHaveBeenCalledWith('REDIS_PORT', 6379);
      expect(configService.get).toHaveBeenCalledWith('REDIS_PASSWORD');
      expect(configService.get).toHaveBeenCalledWith('REDIS_DB', 0);
    });

    it('should handle missing Redis password', () => {
      configService.get = jest.fn((key: string, defaultValue?: any) => {
        if (key === 'REDIS_PASSWORD') return undefined;
        return defaultValue;
      });

      const options = service.createThrottlerOptions();
      expect(options).toBeDefined();
    });
  });
});
