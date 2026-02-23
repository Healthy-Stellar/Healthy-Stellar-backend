import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    try {
      const Redis = require('ioredis');
      const redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD'),
        lazyConnect: true,
        connectTimeout: 5000,
      });

      await redis.connect();
      await redis.ping();
      await redis.quit();

      const responseTime = Date.now() - startTime;
      return this.getStatus(key, true, { responseTime: `${responseTime}ms` });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { responseTime: `${responseTime}ms`, error: error.message }),
      );
    }
  }
}
