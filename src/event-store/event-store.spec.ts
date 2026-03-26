import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { EventStoreService, SNAPSHOT_INTERVAL } from './event-store.service';
import { EventEntity } from './event.entity';
import { AggregateSnapshotEntity } from './aggregate-snapshot.entity';
import { ConcurrencyException } from './concurrency.exception';
import {
  RecordUploaded,
  AccessGranted,
  AccessRevoked,
  RecordAmended,
  EmergencyAccessCreated,
  RecordDeleted,
} from './domain-events';
import { MedicalRecordAggregate } from './medical-record.aggregate';

// ── Helpers ───────────────────────────────────────────────────────────────────

const AGG_ID = 'agg-uuid-1234';

function makeEvent(overrides: Partial<EventEntity> = {}): EventEntity {
  return Object.assign(new EventEntity(), {
    id: 'evt-id',
    aggregateId: AGG_ID,
    aggregateType: 'MedicalRecord',
    eventType: 'RecordUploaded',
    payload: { patientId: 'p1', cid: 'Qm1', recordType: 'lab' },
    metadata: {},
    version: 1,
    occurredAt: new Date(),
    recordedAt: new Date(),
    ...overrides,
  });
}

function buildQb(result: EventEntity | null | EventEntity[]): Partial<SelectQueryBuilder<EventEntity>> {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(Array.isArray(result) ? null : result),
    getMany: jest.fn().mockResolvedValue(Array.isArray(result) ? result : []),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EventStoreService', () => {
  let service: EventStoreService;
  let eventRepo: jest.Mocked<{ findOne: jest.Mock; createQueryBuilder: jest.Mock }>;
  let snapshotRepo: jest.Mocked<{ findOne: jest.Mock }>;
  let dataSource: jest.Mocked<{ transaction: jest.Mock; manager: Partial<EntityManager> }>;

  beforeEach(async () => {
    eventRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    snapshotRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventStoreService,
        { provide: getRepositoryToken(EventEntity), useValue: eventRepo },
        { provide: getRepositoryToken(AggregateSnapshotEntity), useValue: snapshotRepo },
        { provide: DataSource, useValue: { transaction: jest.fn(), manager: {} } },
      ],
    }).compile();

    service = module.get(EventStoreService);
    dataSource = module.get(DataSource) as any;
  });

  // ── append ──────────────────────────────────────────────────────────────────

  describe('append', () => {
    it('persists events starting at version 1 for a new aggregate', async () => {
      const saved: EventEntity[] = [];

      dataSource.transaction.mockImplementation(async (cb: (m: EntityManager) => Promise<void>) => {
        const qb = buildQb(null); // no existing events
        const manager = {
          createQueryBuilder: jest.fn().mockReturnValue(qb),
          create: jest.fn().mockImplementation((_cls, data) => ({ ...data })),
          save: jest.fn().mockImplementation((_cls, entity) => {
            saved.push(entity as EventEntity);
            return Promise.resolve(entity);
          }),
          delete: jest.fn().mockResolvedValue(undefined),
        } as unknown as EntityManager;
        return cb(manager);
      });

      const event = new RecordUploaded(AGG_ID, { patientId: 'p1', cid: 'Qm1', recordType: 'lab', uploadedBy: 'u1' });
      await service.append(AGG_ID, [event], 0);

      expect(saved).toHaveLength(1);
      expect(saved[0].version).toBe(1);
      expect(saved[0].eventType).toBe('RecordUploaded');
    });

    it('assigns consecutive versions when appending multiple events', async () => {
      const saved: EventEntity[] = [];

      dataSource.transaction.mockImplementation(async (cb: (m: EntityManager) => Promise<void>) => {
        const qb = buildQb(makeEvent({ version: 2 })); // existing head at v2
        const manager = {
          createQueryBuilder: jest.fn().mockReturnValue(qb),
          create: jest.fn().mockImplementation((_cls, data) => ({ ...data })),
          save: jest.fn().mockImplementation((_cls, entity) => {
            saved.push(entity as EventEntity);
            return Promise.resolve(entity);
          }),
          delete: jest.fn().mockResolvedValue(undefined),
        } as unknown as EntityManager;
        return cb(manager);
      });

      const events = [
        new AccessGranted(AGG_ID, { grantedTo: 'doc1', grantedBy: 'admin' }),
        new AccessRevoked(AGG_ID, { revokedFrom: 'doc1', revokedBy: 'admin' }),
      ];
      await service.append(AGG_ID, events, 2);

      expect(saved[0].version).toBe(3);
      expect(saved[1].version).toBe(4);
    });

    it('throws ConcurrencyException when expectedVersion does not match', async () => {
      dataSource.transaction.mockImplementation(async (cb: (m: EntityManager) => Promise<void>) => {
        const qb = buildQb(makeEvent({ version: 5 })); // actual head is v5
        const manager = {
          createQueryBuilder: jest.fn().mockReturnValue(qb),
        } as unknown as EntityManager;
        return cb(manager);
      });

      await expect(
        service.append(AGG_ID, [new RecordDeleted(AGG_ID, { deletedBy: 'u1' })], 3),
      ).rejects.toBeInstanceOf(ConcurrencyException);
    });

    it('does nothing when events array is empty', async () => {
      await service.append(AGG_ID, [], 0);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // ── snapshot trigger ────────────────────────────────────────────────────────

  describe('snapshot creation', () => {
    it(`triggers a snapshot rebuild when version reaches a multiple of ${SNAPSHOT_INTERVAL}`, async () => {
      let snapshotSaved = false;

      dataSource.transaction.mockImplementation(async (cb: (m: EntityManager) => Promise<void>) => {
        // Existing head is at SNAPSHOT_INTERVAL - 1, so next version hits the boundary
        const qb = buildQb(makeEvent({ version: SNAPSHOT_INTERVAL - 1 }));
        const allEventsQb = buildQb(
          Array.from({ length: SNAPSHOT_INTERVAL }, (_, i) =>
            makeEvent({ version: i + 1, payload: { patientId: 'p1', cid: 'Qm1', recordType: 'lab' } }),
          ),
        );

        let callCount = 0;
        const manager = {
          createQueryBuilder: jest.fn().mockImplementation(() => {
            callCount++;
            // First call: pessimistic lock for head version
            // Second call: full event load for snapshot rebuild
            return callCount === 1 ? qb : allEventsQb;
          }),
          create: jest.fn().mockImplementation((_cls, data) => ({ ...data })),
          save: jest.fn().mockImplementation((_cls, entity) => {
            if ((entity as any).state) snapshotSaved = true;
            return Promise.resolve(entity);
          }),
          delete: jest.fn().mockResolvedValue(undefined),
        } as unknown as EntityManager;
        return cb(manager);
      });

      await service.append(
        AGG_ID,
        [new RecordUploaded(AGG_ID, { patientId: 'p1', cid: 'Qm1', recordType: 'lab', uploadedBy: 'u1' })],
        SNAPSHOT_INTERVAL - 1,
      );

      expect(snapshotSaved).toBe(true);
    });
  });

  // ── getEvents ───────────────────────────────────────────────────────────────

  describe('getEvents', () => {
    it('returns domain events ordered by version from the given fromVersion', async () => {
      const rows = [makeEvent({ version: 2 }), makeEvent({ version: 3, eventType: 'AccessGranted' as any })];
      const qb = buildQb(rows);
      eventRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.getEvents(AGG_ID, 2);

      expect(result).toHaveLength(2);
      expect(result[0].eventType).toBe('RecordUploaded');
      expect(result[1].eventType).toBe('AccessGranted');
    });
  });

  // ── getSnapshot ─────────────────────────────────────────────────────────────

  describe('getSnapshot', () => {
    it('returns null when no snapshot exists', async () => {
      snapshotRepo.findOne = jest.fn().mockResolvedValue(null);
      expect(await service.getSnapshot(AGG_ID)).toBeNull();
    });

    it('returns a mapped AggregateSnapshot when one exists', async () => {
      const row = Object.assign(new AggregateSnapshotEntity(), {
        aggregateId: AGG_ID,
        aggregateType: 'MedicalRecord',
        version: 50,
        state: { patientId: 'p1', cid: 'Qm1' },
        createdAt: new Date(),
      });
      snapshotRepo.findOne = jest.fn().mockResolvedValue(row);

      const snap = await service.getSnapshot(AGG_ID);

      expect(snap).not.toBeNull();
      expect(snap!.version).toBe(50);
      expect(snap!.state).toEqual({ patientId: 'p1', cid: 'Qm1' });
    });
  });
});

// ── MedicalRecordAggregate ────────────────────────────────────────────────────

describe('MedicalRecordAggregate', () => {
  const BASE_PAYLOAD = { patientId: 'p1', cid: 'Qm1', recordType: 'lab', uploadedBy: 'u1' };

  it('reconstructs state from a RecordUploaded event', () => {
    const agg = MedicalRecordAggregate.rehydrate(AGG_ID, [
      new RecordUploaded(AGG_ID, BASE_PAYLOAD),
    ]);

    expect(agg.state.patientId).toBe('p1');
    expect(agg.state.cid).toBe('Qm1');
    expect(agg.state.isDeleted).toBe(false);
    expect(agg.state.version).toBe(1);
  });

  it('adds a grantee on AccessGranted', () => {
    const agg = MedicalRecordAggregate.rehydrate(AGG_ID, [
      new RecordUploaded(AGG_ID, BASE_PAYLOAD),
      new AccessGranted(AGG_ID, { grantedTo: 'doc1', grantedBy: 'admin' }),
    ]);

    expect(agg.state.accessGrants).toContain('doc1');
    expect(agg.state.version).toBe(2);
  });

  it('removes a grantee on AccessRevoked', () => {
    const agg = MedicalRecordAggregate.rehydrate(AGG_ID, [
      new RecordUploaded(AGG_ID, BASE_PAYLOAD),
      new AccessGranted(AGG_ID, { grantedTo: 'doc1', grantedBy: 'admin' }),
      new AccessRevoked(AGG_ID, { revokedFrom: 'doc1', revokedBy: 'admin' }),
    ]);

    expect(agg.state.accessGrants).not.toContain('doc1');
  });

  it('applies RecordAmended changes to state', () => {
    const agg = MedicalRecordAggregate.rehydrate(AGG_ID, [
      new RecordUploaded(AGG_ID, BASE_PAYLOAD),
      new RecordAmended(AGG_ID, { amendedBy: 'doc1', changes: { cid: 'Qm2' } }),
    ]);

    expect(agg.state.cid).toBe('Qm2');
  });

  it('adds emergency accessor on EmergencyAccessCreated', () => {
    const agg = MedicalRecordAggregate.rehydrate(AGG_ID, [
      new RecordUploaded(AGG_ID, BASE_PAYLOAD),
      new EmergencyAccessCreated(AGG_ID, { accessedBy: 'er-doc', reason: 'critical', expiresAt: '2026-01-01T00:00:00Z' }),
    ]);

    expect(agg.state.accessGrants).toContain('er-doc');
  });

  it('marks the record as deleted on RecordDeleted', () => {
    const agg = MedicalRecordAggregate.rehydrate(AGG_ID, [
      new RecordUploaded(AGG_ID, BASE_PAYLOAD),
      new RecordDeleted(AGG_ID, { deletedBy: 'admin' }),
    ]);

    expect(agg.state.isDeleted).toBe(true);
  });

  it('increments version for every event applied', () => {
    const events = [
      new RecordUploaded(AGG_ID, BASE_PAYLOAD),
      new AccessGranted(AGG_ID, { grantedTo: 'doc1', grantedBy: 'admin' }),
      new AccessRevoked(AGG_ID, { revokedFrom: 'doc1', revokedBy: 'admin' }),
      new RecordDeleted(AGG_ID, { deletedBy: 'admin' }),
    ];
    const agg = MedicalRecordAggregate.rehydrate(AGG_ID, events);
    expect(agg.state.version).toBe(events.length);
  });
});

// ── ConcurrencyException ──────────────────────────────────────────────────────

describe('ConcurrencyException', () => {
  it('includes aggregate id and version numbers in the message', () => {
    const ex = new ConcurrencyException('agg-1', 3, 7);
    expect(ex.message).toContain('agg-1');
    expect(ex.message).toContain('3');
    expect(ex.message).toContain('7');
  });
});
