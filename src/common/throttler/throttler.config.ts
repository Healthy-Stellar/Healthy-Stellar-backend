import { ThrottlerModuleOptions, ThrottlerOptionsFactory } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import Redis from 'ioredis';

@Injectable()
export class ThrottlerConfigService implements ThrottlerOptionsFactory {
  constructor(private configService: ConfigService) {}

  createThrottlerOptions(): ThrottlerModuleOptions {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    const redisDb = this.configService.get<number>('REDIS_DB', 0);

    // Create Redis client for throttler storage
    const redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined,
      db: redisDb,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    return {
      throttlers: [
        {
          name: 'default',
          ttl: 60000, // 60 seconds
          limit: 100, // 100 requests per minute
        },
        {
          name: 'auth',
          ttl: 60000, // 60 seconds
          limit: 5, // 5 requests per minute for auth endpoints
        },
        {
          name: 'read',
          ttl: 60000, // 60 seconds
          limit: 100, // 100 requests per minute for read endpoints
        },
        {
          name: 'write',
          ttl: 60000, // 60 seconds
          limit: 20, // 20 requests per minute for write endpoints
        },
        {
          name: 'admin',
          ttl: 60000, // 60 seconds
          limit: 50, // 50 requests per minute for admin endpoints
        },
      ],
      storage: new ThrottlerStorageRedisService(redis),
    };
  }
}
