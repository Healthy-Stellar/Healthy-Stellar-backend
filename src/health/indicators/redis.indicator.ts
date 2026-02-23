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
      const redis = require('redis');
      const client = redis.createClient({
        url: this.configService.get('REDIS_URL', 'redis://localhost:6379'),
      });
      await client.connect();
      await client.ping();
      await client.quit();
      const responseTime = Date.now() - startTime;
      return this.getStatus(key, true, { responseTime: `${responseTime}ms` });
    } catch (error) {
      throw new HealthCheckError('Redis check failed', this.getStatus(key, false));
    }
  }
}
