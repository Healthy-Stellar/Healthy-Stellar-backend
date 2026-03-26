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
    const isHealthy = status === 'connected';
    const result = this.getStatus(key, isHealthy, { stellarStream: status });
    if (!isHealthy) {
      throw new HealthCheckError('Stellar stream not connected', result);
    }
    return result;
  }
}
