import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RecordEvent, RecordEventType } from '../entities/record-event.entity';
import { RecordSnapshot } from '../entities/record-snapshot.entity';

/** Number of events between automatic snapshot rebuilds */
export const SNAPSHOT_INTERVAL = 100;

export interface RecordState {
  id: string;
  patientId: string;
  cid: string;
  stellarTxHash: string | null;
  recordType: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  sequenceNumber: number;
  deleted: boolean;
}

@Injectable()
export class RecordEventStoreService {
  constructor(
    @InjectRepository(RecordEvent)
    private readonly eventRepo: Repository<RecordEvent>,
    @InjectRepository(RecordSnapshot)
    private readonly snapshotRepo: Repository<RecordSnapshot>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Append a new event for a record.
   * Automatically assigns the next sequence number and triggers a snapshot
   * rebuild when the sequence crosses a SNAPSHOT_INTERVAL boundary.
   */
  async append(
    recordId: string,
    eventType: RecordEventType,
    payload: Record<string, any>,
    causedBy?: string,
  ): Promise<RecordEvent> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the record's event stream to get the next sequence number safely
      const lastEvent = await manager
        .createQueryBuilder(RecordEvent, 'e')
        .where('e.record_id = :recordId', { recordId })
        .orderBy('e.sequence_number', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

      const nextSeq = lastEvent ? lastEvent.sequenceNumber + 1 : 1;

      const event = manager.create(RecordEvent, {
        recordId,
        eventType,
        payload,
        sequenceNumber: nextSeq,
        causedBy: causedBy ?? null,
      });

      const saved = await manager.save(RecordEvent, event);

      // Rebuild snapshot every SNAPSHOT_INTERVAL events
      if (nextSeq % SNAPSHOT_INTERVAL === 0) {
        await this.rebuildSnapshot(recordId, manager);
      }

      return saved;
    });
  }

  /**
   * Return all events for a record in sequence order.
   */
  async getEvents(recordId: string): Promise<RecordEvent[]> {
    return this.eventRepo.find({
      where: { recordId },
      order: { sequenceNumber: 'ASC' },
    });
  }

  /**
   * Replay events to derive the current state of a record.
   * Uses the latest snapshot as a starting point when available.
   */
  async replayToState(recordId: string): Promise<RecordState | null> {
    // Load the most recent snapshot
    const snapshot = await this.snapshotRepo.findOne({
      where: { recordId },
      order: { sequenceNumber: 'DESC' },
    });

    let state: RecordState | null = snapshot
      ? (snapshot.state as RecordState)
      : null;

    const fromSeq = snapshot ? snapshot.sequenceNumber + 1 : 1;

    // Load only events after the snapshot
    const events = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.record_id = :recordId', { recordId })
      .andWhere('e.sequence_number >= :fromSeq', { fromSeq })
      .orderBy('e.sequence_number', 'ASC')
      .getMany();

    if (!snapshot && events.length === 0) {
      return null;
    }

    for (const event of events) {
      state = this.applyEvent(state, event);
    }

    return state;
  }

  /**
   * Replay a specific list of events in order (used for testing / out-of-order handling).
   * Events are sorted by sequenceNumber before applying.
   */
  replayEvents(events: RecordEvent[]): RecordState | null {
    const sorted = [...events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    let state: RecordState | null = null;
    for (const event of sorted) {
      state = this.applyEvent(state, event);
    }
    return state;
  }

  /**
   * Apply a single event to the current state (pure function — no side effects).
   */
  applyEvent(state: RecordState | null, event: RecordEvent): RecordState {
    const now = event.timestamp ?? new Date();

    switch (event.eventType) {
      case RecordEventType.RECORD_CREATED:
      case RecordEventType.RECORD_MIGRATED:
        return {
          id: event.recordId,
          patientId: event.payload.patientId,
          cid: event.payload.cid,
          stellarTxHash: event.payload.stellarTxHash ?? null,
          recordType: event.payload.recordType,
          description: event.payload.description ?? null,
          createdAt: event.payload.createdAt ? new Date(event.payload.createdAt) : now,
          updatedAt: now,
          sequenceNumber: event.sequenceNumber,
          deleted: false,
        };

      case RecordEventType.RECORD_UPDATED:
        if (!state) return state;
        return {
          ...state,
          ...event.payload.changes,
          updatedAt: now,
          sequenceNumber: event.sequenceNumber,
        };

      case RecordEventType.RECORD_DESCRIPTION_CHANGED:
        if (!state) return state;
        return {
          ...state,
          description: event.payload.description,
          updatedAt: now,
          sequenceNumber: event.sequenceNumber,
        };

      case RecordEventType.RECORD_TYPE_CHANGED:
        if (!state) return state;
        return {
          ...state,
          recordType: event.payload.recordType,
          updatedAt: now,
          sequenceNumber: event.sequenceNumber,
        };

      case RecordEventType.RECORD_STELLAR_ANCHORED:
        if (!state) return state;
        return {
          ...state,
          stellarTxHash: event.payload.stellarTxHash,
          updatedAt: now,
          sequenceNumber: event.sequenceNumber,
        };

      case RecordEventType.RECORD_DELETED:
        if (!state) return state;
        return {
          ...state,
          deleted: true,
          updatedAt: now,
          sequenceNumber: event.sequenceNumber,
        };

      default:
        return state;
    }
  }

  /**
   * Rebuild (or create) the snapshot for a record at its current head.
   * Called automatically every SNAPSHOT_INTERVAL events, or manually.
   */
  async rebuildSnapshot(
    recordId: string,
    manager = this.dataSource.manager,
  ): Promise<RecordSnapshot | null> {
    const events = await manager
      .createQueryBuilder(RecordEvent, 'e')
      .where('e.record_id = :recordId', { recordId })
      .orderBy('e.sequence_number', 'ASC')
      .getMany();

    if (events.length === 0) return null;

    const state = this.replayEvents(events);
    if (!state) return null;

    const lastSeq = events[events.length - 1].sequenceNumber;

    // Upsert: delete old snapshot and insert new one
    await manager.delete(RecordSnapshot, { recordId });

    const snapshot = manager.create(RecordSnapshot, {
      recordId,
      sequenceNumber: lastSeq,
      state: state as unknown as Record<string, any>,
    });

    return manager.save(RecordSnapshot, snapshot);
  }

  /**
   * Return the latest snapshot for a record (may be null).
   */
  async getSnapshot(recordId: string): Promise<RecordSnapshot | null> {
    return this.snapshotRepo.findOne({
      where: { recordId },
      order: { sequenceNumber: 'DESC' },
    });
  }
}
