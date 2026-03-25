import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisLockService } from './redis-lock.service';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation((options) => {
    return {
      options,
      disconnect: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
  });
});

describe('RedisLockService', () => {
  let service: RedisLockService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisLockService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => defaultValue || 'mock-value'),
          },
        },
      ],
    }).compile();

    service = module.get<RedisLockService>(RedisLockService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should implement retryStrategy properly with max 10 retries', () => {
    service.onModuleInit();
    const redisInstance = (service as any).redis;
    
    expect(redisInstance.options.maxRetriesPerRequest).toBeNull();
    const retryStrategy = redisInstance.options.retryStrategy;
    expect(typeof retryStrategy).toBe('function');

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
      return undefined as never;
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    for (let i = 1; i <= 9; i++) {
        const ms = retryStrategy(i);
        expect(ms).toBe(3000);
        expect(errorSpy).toHaveBeenCalledWith(`[Redis Lock] Connection attempt ${i} failed.`);
        expect(exitSpy).not.toHaveBeenCalled();
    }

    const ms10 = retryStrategy(10);
    expect(ms10).toBe(3000);
    expect(errorSpy).toHaveBeenCalledWith(`[Redis Lock] Max connection retries (10) exhausted. Exiting...`);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
