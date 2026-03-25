import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RecordEventStoreService, SNAPSHOT_INTERVAL, RecordState } from './record-event-store.service';
import { RecordEvent, RecordEventType } from '../entities/record-event.entity';
import { RecordSnapshot } from '../entities/record-snapshot.entity';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(
  overrides: Partial<RecordEvent> & { eventType: RecordEventType; payload: Record<string, any> },
): RecordEvent {
  return {
    id: `evt-${Math.random()}`,
    recordId: 'record-1',
    sequenceNumber: 1,
    timestamp: new Date('2024-01-01T00:00:00Z'),
    causedBy: null,
    ...overrides,
  } as RecordEvent;
}

const BASE_CREATED_PAYLOAD = {
  patientId: 'patient-1',
  cid: 'QmABC',
  stellarTxHash: 'tx-hash-1',
  recordType: 'MEDICAL_REPORT',
  description: 'Initial record',
  createdAt: '2024-01-01T00:00:00Z',
};

// ── Mock factories ────────────────────────────────────────────────────────────

function makeEventRepo(events: RecordEvent[] = []) {
  return {
    find: jest.fn().mockResolvedValue(events),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((data) => data),
    save: jest.fn((e) => Promise.resolve({ ...e, id: 'saved-id' })),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue(events),
    }),
  };
}

function makeSnapshotRepo(snapshot: RecordSnapshot | null = null) {
  return {
    findOne: jest.fn().mockResolvedValue(snapshot),
    create: jest.fn((data) => data),
    save: jest.fn((s) => Promise.resolve({ ...s, id: 'snap-id' })),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function makeDataSource(events: RecordEvent[] = []) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue(events),
  };

  const manager = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    create: jest.fn((_, data) => data),
    save: jest.fn((_, e) => Promise.resolve({ ...e, id: 'saved-id' })),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  return {
    transaction: jest.fn((cb) => cb(manager)),
    manager,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RecordEventStoreService', () => {
  let service: RecordEventStoreService;
  let eventRepo: ReturnType<typeof makeEventRepo>;
  let snapshotRepo: ReturnType<typeof makeSnapshotRepo>;
  let dataSource: ReturnType<typeof makeDataSource>;

  beforeEach(async () => {
    eventRepo = makeEventRepo();
    snapshotRepo = makeSnapshotRepo();
    dataSource = makeDataSource();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordEventStoreService,
        { provide: getRepositoryToken(RecordEvent), useValue: eventRepo },
        { provide: getRepositoryToken(RecordSnapshot), useValue: snapshotRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(RecordEventStoreService);
  });

  // ── applyEvent ──────────────────────────────────────────────────────────────

  describe('applyEvent', () => {
    it('creates initial state from RECORD_CREATED event', () => {
      const event = makeEvent({
        eventType: RecordEventType.RECORD_CREATED,
        payload: BASE_CREATED_PAYLOAD,
        sequenceNumber: 1,
      });

      const state = service.applyEvent(null, event);

      expect(state).toMatchObject({
        id: 'record-1',
        patientId: 'patient-1',
        cid: 'QmABC',
        stellarTxHash: 'tx-hash-1',
        recordType: 'MEDICAL_REPORT',
        description: 'Initial record',
        sequenceNumber: 1,
        deleted: false,
      });
    });

    it('creates initial state from RECORD_MIGRATED event', () => {
      const event = makeEvent({
        eventType: RecordEventType.RECORD_MIGRATED,
        payload: BASE_CREATED_PAYLOAD,
        sequenceNumber: 1,
      });

      const state = service.applyEvent(null, event);
      expect(state.id).toBe('record-1');
      expect(state.deleted).toBe(false);
    });

    it('applies RECORD_DESCRIPTION_CHANGED to existing state', () => {
      const created = makeEvent({
        eventType: RecordEventType.RECORD_CREATED,
        payload: BASE_CREATED_PAYLOAD,
        sequenceNumber: 1,
      });
      let state = service.applyEvent(null, created);

      const updated = makeEvent({
        eventType: RecordEventType.RECORD_DESCRIPTION_CHANGED,
        payload: { description: 'Updated description' },
        sequenceNumber: 2,
        timestamp: new Date('2024-01-02T00:00:00Z'),
      });
      state = service.applyEvent(state, updated);

      expect(state.description).toBe('Updated description');
      expect(state.sequenceNumber).toBe(2);
      // Other fields unchanged
      expect(state.cid).toBe('QmABC');
    });

    it('applies RECORD_TYPE_CHANGED to existing state', () => {
      let state = service.applyEvent(
        null,
        makeEvent({ eventType: RecordEventType.RECORD_CREATED, payload: BASE_CREATED_PAYLOAD, sequenceNumber: 1 }),
      );

      state = service.applyEvent(
        state,
        makeEvent({
          eventType: RecordEventType.RECORD_TYPE_CHANGED,
          payload: { recordType: 'LAB_RESULT' },
          sequenceNumber: 2,
        }),
      );

      expect(state.recordType).toBe('LAB_RESULT');
    });

    it('applies RECORD_STELLAR_ANCHORED to existing state', () => {
      let state = service.applyEvent(
        null,
        makeEvent({ eventType: RecordEventType.RECORD_CREATED, payload: { ...BASE_CREATED_PAYLOAD, stellarTxHash: null }, sequenceNumber: 1 }),
      );

      state = service.applyEvent(
        state,
        makeEvent({
          eventType: RecordEventType.RECORD_STELLAR_ANCHORED,
          payload: { stellarTxHash: 'new-tx-hash' },
          sequenceNumber: 2,
        }),
      );

      expect(state.stellarTxHash).toBe('new-tx-hash');
    });

    it('marks record as deleted on RECORD_DELETED event', () => {
      let state = service.applyEvent(
        null,
        makeEvent({ eventType: RecordEventType.RECORD_CREATED, payload: BASE_CREATED_PAYLOAD, sequenceNumber: 1 }),
      );

      state = service.applyEvent(
        state,
        makeEvent({ eventType: RecordEventType.RECORD_DELETED, payload: {}, sequenceNumber: 2 }),
      );

      expect(state.deleted).toBe(true);
    });

    it('returns null state unchanged for unknown event type on null state', () => {
      const event = makeEvent({
        eventType: 'UNKNOWN_EVENT' as RecordEventType,
        payload: {},
        sequenceNumber: 1,
      });
      const state = service.applyEvent(null, event);
      expect(state).toBeNull();
    });
  });

  // ── replayEvents ────────────────────────────────────────────────────────────

  describe('replayEvents', () => {
    it('replays a sequence of events to derive final state', () => {
      const events: RecordEvent[] = [
        makeEvent({ eventType: RecordEventType.RECORD_CREATED, payload: BASE_CREATED_PAYLOAD, sequenceNumber: 1 }),
        makeEvent({ eventType: RecordEventType.RECORD_DESCRIPTION_CHANGED, payload: { description: 'v2' }, sequenceNumber: 2 }),
        makeEvent({ eventType: RecordEventType.RECORD_TYPE_CHANGED, payload: { recordType: 'LAB_RESULT' }, sequenceNumber: 3 }),
      ];

      const state = service.replayEvents(events);

      expect(state.description).toBe('v2');
      expect(state.recordType).toBe('LAB_RESULT');
      expect(state.sequenceNumber).toBe(3);
    });

    it('handles out-of-order events by sorting on sequenceNumber', () => {
      // Deliver events in reverse order — should still produce correct state
      const events: RecordEvent[] = [
        makeEvent({ eventType: RecordEventType.RECORD_DESCRIPTION_CHANGED, payload: { description: 'v2' }, sequenceNumber: 2 }),
        makeEvent({ eventType: RecordEventType.RECORD_CREATED, payload: BASE_CREATED_PAYLOAD, sequenceNumber: 1 }),
      ];

      const state = service.replayEvents(events);

      // RECORD_CREATED must be applied first even though it arrived second
      expect(state).not.toBeNull();
      expect(state.description).toBe('v2');
      expect(state.patientId).toBe('patient-1');
    });

    it('returns null for empty event list', () => {
      expect(service.replayEvents([])).toBeNull();
    });

    it('handles a large sequence of events correctly', () => {
      const events: RecordEvent[] = [
        makeEvent({ eventType: RecordEventType.RECORD_CREATED, payload: BASE_CREATED_PAYLOAD, sequenceNumber: 1 }),
      ];

      // Apply 50 description changes
      for (let i = 2; i <= 51; i++) {
        events.push(
          makeEvent({
            eventType: RecordEventType.RECORD_DESCRIPTION_CHANGED,
            payload: { description: `version-${i}` },
            sequenceNumber: i,
          }),
        );
      }

      const state = service.replayEvents(events);
      expect(state.description).toBe('version-51');
      expect(state.sequenceNumber).toBe(51);
    });
  });

  // ── snapshot ────────────────────────────────────────────────────────────────

  describe('rebuildSnapshot', () => {
    it('builds a snapshot from all events', async () => {
      const events: RecordEvent[] = [
        makeEvent({ eventType: RecordEventType.RECORD_CREATED, payload: BASE_CREATED_PAYLOAD, sequenceNumber: 1 }),
        makeEvent({ eventType: RecordEventType.RECORD_DESCRIPTION_CHANGED, payload: { description: 'snap-desc' }, sequenceNumber: 2 }),
      ];

      // Wire the manager's queryBuilder to return our events
      const qb = dataSource.manager.createQueryBuilder();
      (qb.getMany as jest.Mock).mockResolvedValue(events);

      const snapshot = await service.rebuildSnapshot('record-1', dataSource.manager as any);

      expect(dataSource.manager.delete).toHaveBeenCalledWith(RecordSnapshot, { recordId: 'record-1' });
      expect(dataSource.manager.save).toHaveBeenCalled();
      expect(snapshot).toBeDefined();
    });

    it('returns null when no events exist', async () => {
      const qb = dataSource.manager.createQueryBuilder();
      (qb.getMany as jest.Mock).mockResolvedValue([]);

      const snapshot = await service.rebuildSnapshot('record-1', dataSource.manager as any);
      expect(snapshot).toBeNull();
    });
  });

  describe('replayToState', () => {
    it('uses snapshot as base and replays only delta events', async () => {
      const snapshotState: RecordState = {
        id: 'record-1',
        patientId: 'patient-1',
        cid: 'QmABC',
        stellarTxHash: 'tx-1',
        recordType: 'MEDICAL_REPORT',
        description: 'snap-desc',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        sequenceNumber: 100,
        deleted: false,
      };

      const snap: RecordSnapshot = {
        id: 'snap-1',
        recordId: 'record-1',
        sequenceNumber: 100,
        state: snapshotState as unknown as Record<string, any>,
        createdAt: new Date(),
      };

      snapshotRepo.findOne.mockResolvedValue(snap);

      const deltaEvent = makeEvent({
        eventType: RecordEventType.RECORD_DESCRIPTION_CHANGED,
        payload: { description: 'post-snap' },
        sequenceNumber: 101,
      });

      // The eventRepo.createQueryBuilder chain for delta events
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([deltaEvent]),
      };
      eventRepo.createQueryBuilder.mockReturnValue(qb);

      const state = await service.replayToState('record-1');

      expect(state.description).toBe('post-snap');
      expect(state.sequenceNumber).toBe(101);
    });

    it('returns null when no snapshot and no events', async () => {
      snapshotRepo.findOne.mockResolvedValue(null);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      eventRepo.createQueryBuilder.mockReturnValue(qb);

      const state = await service.replayToState('record-1');
      expect(state).toBeNull();
    });
  });

  // ── append ──────────────────────────────────────────────────────────────────

  describe('append', () => {
    it('assigns sequence_number = 1 for first event', async () => {
      const qb = dataSource.manager.createQueryBuilder();
      (qb.getOne as jest.Mock).mockResolvedValue(null); // no prior events

      await service.append('record-1', RecordEventType.RECORD_CREATED, BASE_CREATED_PAYLOAD, 'user-1');

      expect(dataSource.manager.save).toHaveBeenCalledWith(
        RecordEvent,
        expect.objectContaining({ sequenceNumber: 1, recordId: 'record-1' }),
      );
    });

    it('increments sequence_number from last event', async () => {
      const qb = dataSource.manager.createQueryBuilder();
      (qb.getOne as jest.Mock).mockResolvedValue({ sequenceNumber: 5 });

      await service.append('record-1', RecordEventType.RECORD_DESCRIPTION_CHANGED, { description: 'new' });

      expect(dataSource.manager.save).toHaveBeenCalledWith(
        RecordEvent,
        expect.objectContaining({ sequenceNumber: 6 }),
      );
    });

    it(`triggers snapshot rebuild when sequence crosses SNAPSHOT_INTERVAL boundary`, async () => {
      const qb = dataSource.manager.createQueryBuilder();
      // Last event is at SNAPSHOT_INTERVAL - 1, so next will be SNAPSHOT_INTERVAL
      (qb.getOne as jest.Mock).mockResolvedValue({ sequenceNumber: SNAPSHOT_INTERVAL - 1 });
      // rebuildSnapshot needs getMany
      (qb.getMany as jest.Mock).mockResolvedValue([
        makeEvent({ eventType: RecordEventType.RECORD_CREATED, payload: BASE_CREATED_PAYLOAD, sequenceNumber: 1 }),
      ]);

      const rebuildSpy = jest.spyOn(service, 'rebuildSnapshot').mockResolvedValue(null);

      await service.append('record-1', RecordEventType.RECORD_DESCRIPTION_CHANGED, { description: 'snap-trigger' });

      expect(rebuildSpy).toHaveBeenCalledWith('record-1', expect.anything());
    });

    it('does NOT trigger snapshot rebuild for non-boundary sequence numbers', async () => {
      const qb = dataSource.manager.createQueryBuilder();
      (qb.getOne as jest.Mock).mockResolvedValue({ sequenceNumber: 3 });

      const rebuildSpy = jest.spyOn(service, 'rebuildSnapshot').mockResolvedValue(null);

      await service.append('record-1', RecordEventType.RECORD_DESCRIPTION_CHANGED, { description: 'no-snap' });

      expect(rebuildSpy).not.toHaveBeenCalled();
    });
  });
});
