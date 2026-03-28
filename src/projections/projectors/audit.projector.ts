import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Logger } from '@nestjs/common';
import {
  RecordUploadedEvent,
  RecordAmendedEvent,
  AccessGrantedEvent,
  AccessRevokedEvent,
} from './domain-events';
import { CheckpointService } from '../checkpoint/checkpoint.service';

type AuditableEvent =
  | RecordUploadedEvent
  | RecordAmendedEvent
  | AccessGrantedEvent
  | AccessRevokedEvent;

class AuditLog {
  id: string;
  eventType: string;
  entityId: string;
  actorId: string;
  payload: Record<string, unknown>;
  eventVersion: number;
  occurredAt: Date;
}

const PROJECTOR_NAME = 'AuditProjector';

@EventsHandler(RecordUploadedEvent, RecordAmendedEvent, AccessGrantedEvent, AccessRevokedEvent)
export class AuditProjector implements IEventHandler<AuditableEvent> {
  private readonly logger = new Logger(AuditProjector.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly checkpoints: CheckpointService,
    @InjectQueue('projection-dlq') private readonly dlq: Queue,
  ) {}

  async handle(event: AuditableEvent): Promise<void> {
    const lastVersion = await this.checkpoints.getVersion(PROJECTOR_NAME);

    if (event.version <= lastVersion) {
      return;
    }

    try {
      // Use event version as a natural idempotency key — duplicate inserts ignored
      await this.auditRepo
        .createQueryBuilder()
        .insert()
        .into(AuditLog)
        .values({
          id: () => 'gen_random_uuid()',
          eventType: event.constructor.name,
          entityId: this.extractEntityId(event),
          actorId: this.extractActorId(event),
          payload: event as unknown as Record<string, unknown>,
          eventVersion: event.version,
          occurredAt: event.occurredAt,
        })
        .orIgnore() // idempotent: unique on event_version enforced at DB level
        .execute();

      await this.checkpoints.advance(PROJECTOR_NAME, event.version);
    } catch (err) {
      this.logger.error(`${PROJECTOR_NAME}: failed on version ${event.version} — ${err.message}`);
      await this.dlq.add(
        'projection-failed',
        { projectorName: PROJECTOR_NAME, event, error: err.message },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      );
    }
  }

  private extractEntityId(event: AuditableEvent): string {
    if (event instanceof RecordUploadedEvent || event instanceof RecordAmendedEvent) {
      return event.recordId;
    }
    return event.grantId;
  }

  private extractActorId(event: AuditableEvent): string {
    if (event instanceof RecordUploadedEvent) return event.uploadedBy;
    if (event instanceof RecordAmendedEvent) return event.amendedBy;
    if (event instanceof AccessGrantedEvent) return event.grantedBy;
    return event.revokedBy;
  }
}
