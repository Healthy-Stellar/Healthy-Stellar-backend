import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { OnChainEventListenerService } from './services/on-chain-event-listener.service';

@Injectable()
export class EventListenerHealthIndicator extends HealthIndicator {
  constructor(private readonly listener: OnChainEventListenerService) {
    super();
  }

  check(key = 'event_listener'): HealthIndicatorResult {
    const healthy = this.listener.isHealthy();
    const result = this.getStatus(key, healthy);
    if (!healthy) throw new HealthCheckError('Event listener disconnected > 2 min', result);
    return result;
  }
}
