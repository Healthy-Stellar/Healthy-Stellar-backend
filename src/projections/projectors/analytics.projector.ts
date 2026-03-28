import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { RecordUploadedEvent, AccessGrantedEvent, AccessRevokedEvent } from './domain-events';
import { CheckpointService } from '../checkpoint/checkpoint.service';

type AnalyticsEvent = RecordUploadedEvent | AccessGrantedEvent | AccessRevokedEvent;

class AnalyticsSnapshot {
  id: string;
  patientId: string;
  totalRecords: number;
  activeGrants: number;
  revokedGrants: number;
  lastEventAt: Date;
}

const PROJECTOR_NAME = 'AnalyticsProjector';

@EventsHandler(RecordUploadedEvent, AccessGrantedEvent, AccessRevokedEvent)
export class AnalyticsProjector implements IEventHandler<AnalyticsEvent> {
  private readonly logger = new Logger(AnalyticsProjector.name);

  constructor(
    @InjectRepository(AnalyticsSnapshot)
    private readonly snapshotRepo: Repository<AnalyticsSnapshot>,
    private readonly checkpoints: CheckpointService,
    @InjectQueue('projection-dlq') private readonly dlq: Queue,
  ) {}

  async handle(event: AnalyticsEvent): Promise<void> {
    const lastVersion = await this.checkpoints.getVersion(PROJECTOR_NAME);

    if (event.version <= lastVersion) {
      return;
    }

    try {
      await this.upsertSnapshot(event);
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

  private async upsertSnapshot(event: AnalyticsEvent): Promise<void> {
    // Build the increment deltas based on event type
    const delta = {
      totalRecords: event instanceof RecordUploadedEvent ? 1 : 0,
      activeGrants: event instanceof AccessGrantedEvent ? 1 : 0,
      revokedGrants: event instanceof AccessRevokedEvent ? 1 : 0,
      activeGrantsDecrement: event instanceof AccessRevokedEvent ? 1 : 0,
    };

    await this.snapshotRepo
      .createQueryBuilder()
      .insert()
      .into(AnalyticsSnapshot)
      .values({
        id: () => 'gen_random_uuid()',
        patientId: event.patientId,
        totalRecords: delta.totalRecords,
        activeGrants: delta.activeGrants,
        revokedGrants: delta.revokedGrants,
        lastEventAt: event.occurredAt,
      })
      .orUpdate(
        ['total_records', 'active_grants', 'revoked_grants', 'last_event_at'],
        ['patient_id'],
        {
          skipUpdateIfNoValuesChanged: false,
          upsertType: 'on-conflict-do-update',
        },
      )
      .setParameter('totalRecords', delta.totalRecords)
      .setParameter('activeGrants', delta.activeGrants)
      .setParameter('revokedGrants', delta.revokedGrants)
      .setParameter('occurredAt', event.occurredAt)
      .execute();

    // Apply decrements for revocation separately to keep upsert readable
    if (event instanceof AccessRevokedEvent) {
      await this.snapshotRepo
        .createQueryBuilder()
        .update(AnalyticsSnapshot)
        .set({
          activeGrants: () => 'GREATEST(active_grants - 1, 0)',
          lastEventAt: event.occurredAt,
        })
        .where('patient_id = :patientId', { patientId: event.patientId })
        .execute();
    }
  }
}
