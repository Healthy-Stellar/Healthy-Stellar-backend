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
import { AuditLogProjection } from '../entities/audit-log-projection.entity';

type AuditableEvent =
  | RecordUploadedEvent
  | RecordAmendedEvent
  | AccessGrantedEvent
  | AccessRevokedEvent;

const PROJECTOR_NAME = 'AuditProjector';

@EventsHandler(RecordUploadedEvent, RecordAmendedEvent, AccessGrantedEvent, AccessRevokedEvent)
export class AuditProjector implements IEventHandler<AuditableEvent> {
  private readonly logger = new Logger(AuditProjector.name);

  constructor(
    @InjectRepository(AuditLogProjection)
    private readonly auditRepo: Repository<AuditLogProjection>,
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
        .into(AuditLogProjection)
        .values({
          aggregateId: this.extractEntityId(event),
          aggregateType: this.extractAggregateType(event),
          eventType: event.constructor.name,
          payload: event as unknown as Record<string, unknown>,
          version: event.version,
          occurredAt: event.occurredAt,
        })
        .orIgnore()
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

  private extractAggregateType(event: AuditableEvent): string {
    if (event instanceof RecordUploadedEvent || event instanceof RecordAmendedEvent) {
      return 'MedicalRecord';
    }
    return 'AccessGrant';
  }
}
