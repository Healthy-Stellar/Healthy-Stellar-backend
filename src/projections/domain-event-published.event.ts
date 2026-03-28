import { IEvent } from '@nestjs/cqrs';
import { DomainEvent } from '../../event-store/domain-events';

/**
 * Wraps a persisted DomainEvent so it can be dispatched on the NestJS EventBus.
 * globalVersion is the row's sequential position used by checkpoints.
 */
export class DomainEventPublished implements IEvent {
  constructor(
    public readonly domainEvent: DomainEvent,
    public readonly globalVersion: number,
  ) {}
}
