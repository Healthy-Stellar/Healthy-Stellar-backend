import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEntity } from './event.entity';
import { AggregateSnapshotEntity } from './aggregate-snapshot.entity';
import { DomainEvent } from './domain-events';
import { ConcurrencyException } from './concurrency.exception';
import { DomainEventPublished } from '../projections/domain-event-published.event';

export const SNAPSHOT_INTERVAL = 50;

@Injectable()
export class EventStoreService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(AggregateSnapshotEntity)
    private readonly snapshotRepo: Repository<AggregateSnapshotEntity>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBus,
  ) {}

  async append(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number,
  ): Promise<void> {
    if (events.length === 0) return;

    const savedEntities: EventEntity[] = [];

    await this.dataSource.transaction(async (manager) => {
      const lastEvent = await manager
        .createQueryBuilder(EventEntity, 'e')
        .where('e.aggregate_id = :aggregateId', { aggregateId })
        .orderBy('e.version', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

      const currentVersion = lastEvent?.version ?? 0;

      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyException(aggregateId, expectedVersion, currentVersion);
      }

      let nextVersion = currentVersion + 1;

      for (const domainEvent of events) {
        const entity = manager.create(EventEntity, {
          aggregateId,
          aggregateType: domainEvent.aggregateType,
          eventType: domainEvent.eventType,
          payload: domainEvent.payload as Record<string, unknown>,
          metadata: domainEvent.metadata ?? {},
          version: nextVersion++,
        });
        const saved = await manager.save(EventEntity, entity);
        savedEntities.push(saved);
      }

      const headVersion = nextVersion - 1;
      if (headVersion % SNAPSHOT_INTERVAL === 0) {
        await this._rebuildSnapshot(aggregateId, manager);
      }
    });

    // Publish to EventBus after successful transaction
    for (const entity of savedEntities) {
      this.eventBus.publish(
        new DomainEventPublished(
          {
            eventType: entity.eventType,
            aggregateId: entity.aggregateId,
            aggregateType: entity.aggregateType,
            payload: entity.payload,
            metadata: entity.metadata,
            version: entity.version,
          },
          entity.version,
        ),
      );
    }
  }

  async getEvents(aggregateId: string, fromVersion = 1): Promise<DomainEvent[]> {
    const rows = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.aggregate_id = :aggregateId', { aggregateId })
      .andWhere('e.version >= :fromVersion', { fromVersion })
      .orderBy('e.version', 'ASC')
      .getMany();

    return rows.map((r) => this._rowToDomainEvent(r));
  }

  async getSnapshot(aggregateId: string) {
    const row = await this.snapshotRepo.findOne({
      where: { aggregateId },
      order: { version: 'DESC' },
    });
    if (!row) return null;
    return {
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType,
      version: row.version,
      state: row.state,
    };
  }

  private async _rebuildSnapshot(
    aggregateId: string,
    manager = this.dataSource.manager,
  ): Promise<void> {
    const rows = await manager
      .createQueryBuilder(EventEntity, 'e')
      .where('e.aggregate_id = :aggregateId', { aggregateId })
      .orderBy('e.version', 'ASC')
      .getMany();

    if (rows.length === 0) return;

    const lastRow = rows[rows.length - 1];
    const state = rows.reduce<Record<string, unknown>>(
      (acc, row) => ({ ...acc, ...row.payload }),
      {},
    );

    await manager.delete(AggregateSnapshotEntity, { aggregateId });

    const snapshot = manager.create(AggregateSnapshotEntity, {
      aggregateId,
      aggregateType: lastRow.aggregateType,
      version: lastRow.version,
      state,
    });
    await manager.save(AggregateSnapshotEntity, snapshot);
  }

  private _rowToDomainEvent(row: EventEntity): DomainEvent {
    return {
      eventType: row.eventType,
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType,
      payload: row.payload,
      metadata: row.metadata,
      version: row.version,
    };
  }
}
