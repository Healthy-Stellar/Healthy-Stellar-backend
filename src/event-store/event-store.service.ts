import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEntity } from './event.entity';
import { AggregateSnapshotEntity, AggregateSnapshot } from './aggregate-snapshot.entity';
import { DomainEvent } from './domain-events';
import { ConcurrencyException } from './concurrency.exception';

/** A snapshot is taken every SNAPSHOT_INTERVAL events. */
export const SNAPSHOT_INTERVAL = 50;

@Injectable()
export class EventStoreService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(AggregateSnapshotEntity)
    private readonly snapshotRepo: Repository<AggregateSnapshotEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Append one or more events to the store for a given aggregate.
   *
   * @param aggregateId     - UUID of the aggregate root.
   * @param events          - Ordered list of domain events to persist.
   * @param expectedVersion - The caller's view of the current version (0 = new aggregate).
   *                          Throws ConcurrencyException if the actual version differs.
   */
  async append(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number,
  ): Promise<void> {
    if (events.length === 0) return;

    await this.dataSource.transaction(async (manager) => {
      // Pessimistic lock: read the current head version for this aggregate.
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
        await manager.save(EventEntity, entity);
      }

      // Take a snapshot every SNAPSHOT_INTERVAL events.
      const headVersion = nextVersion - 1;
      if (headVersion % SNAPSHOT_INTERVAL === 0) {
        await this._rebuildSnapshot(aggregateId, manager);
      }
    });
  }

  /**
   * Return all events for an aggregate, optionally starting from a given version.
   */
  async getEvents(aggregateId: string, fromVersion = 1): Promise<DomainEvent[]> {
    const rows = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.aggregate_id = :aggregateId', { aggregateId })
      .andWhere('e.version >= :fromVersion', { fromVersion })
      .orderBy('e.version', 'ASC')
      .getMany();

    return rows.map((r) => this._rowToDomainEvent(r));
  }

  /**
   * Return the latest snapshot for an aggregate, or null if none exists.
   */
  async getSnapshot(aggregateId: string): Promise<AggregateSnapshot | null> {
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

  // ── Private helpers ─────────────────────────────────────────────────────────

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

    // Build a simple state projection from all events.
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
    };
  }
}
