import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { RecordUploadedEvent, AccessGrantedEvent, AccessRevokedEvent } from './domain-events';
import { CheckpointService } from '../checkpoint/checkpoint.service';
import { AnalyticsSnapshot } from '../entities/analytics-snapshot.entity';

type AnalyticsEvent = RecordUploadedEvent | AccessGrantedEvent | AccessRevokedEvent;

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
    const snapshotDate = event.occurredAt.toISOString().slice(0, 10);
    const delta = {
      totalRecordsUploaded: event instanceof RecordUploadedEvent ? 1 : 0,
      totalAccessGranted: event instanceof AccessGrantedEvent ? 1 : 0,
      totalAccessRevoked: event instanceof AccessRevokedEvent ? 1 : 0,
      activeGrantsDecrement: event instanceof AccessRevokedEvent ? 1 : 0,
    };

    await this.snapshotRepo
      .createQueryBuilder()
      .insert()
      .into(AnalyticsSnapshot)
      .values({
        snapshotDate,
        totalRecordsUploaded: delta.totalRecordsUploaded,
        totalAccessGranted: delta.totalAccessGranted,
        totalAccessRevoked: delta.totalAccessRevoked,
      })
      .orUpdate(
        [
          'total_records_uploaded',
          'total_access_granted',
          'total_access_revoked',
          'updated_at',
        ],
        ['snapshot_date'],
        {
          skipUpdateIfNoValuesChanged: false,
          upsertType: 'on-conflict-do-update',
        },
      )
      .setParameter('totalRecordsUploaded', delta.totalRecordsUploaded)
      .setParameter('totalAccessGranted', delta.totalAccessGranted)
      .setParameter('totalAccessRevoked', delta.totalAccessRevoked)
      .execute();

    // Apply decrements for revocation separately to keep upsert readable
    if (event instanceof AccessRevokedEvent) {
      await this.snapshotRepo
        .createQueryBuilder()
        .update(AnalyticsSnapshot)
        .set({
          totalAccessRevoked: () => 'total_access_revoked + 1',
        })
        .where('snapshot_date = :snapshotDate', { snapshotDate })
        .execute();
    }
  }
}
