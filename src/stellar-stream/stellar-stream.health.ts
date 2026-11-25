import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { StellarStreamService } from './stellar-stream.service';

@Injectable()
export class StellarStreamHealthIndicator extends HealthIndicator {
  constructor(private readonly stream: StellarStreamService) {
    super();
  }

  check(key: string): HealthIndicatorResult {
    const status = this.stream.status;
    const redisUp = this.stream.redisAvailable;
    const isHealthy = status === 'connected' && redisUp;
    const result = this.getStatus(key, isHealthy, {
      stellarStream: status,
      redis: redisUp ? 'up' : 'down',
    });
    if (!isHealthy) {
      throw new HealthCheckError('Stellar stream not connected', result);
    }
    return result;
  }
}
