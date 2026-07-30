import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StellarStreamService, StreamStatus } from './stellar-stream.service';
import { Record } from '../records/entities/record.entity';
import { AccessGrant, GrantStatus, AccessLevel } from '../access-control/entities/access-grant.entity';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONTRACT = 'CCONTRACT123';

function makeTx(overrides: Partial<{
  hash: string;
  successful: boolean;
  source_account: string;
  envelope_xdr: string;
  paging_token: string;
}> = {}) {
  return {
    hash: 'txhash1',
    successful: true,
    source_account: CONTRACT,
    envelope_xdr: '',
    paging_token: 'token-1',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<Record> = {}): Record {
  return Object.assign(new Record(), {
    id: 'rec-1',
    patientId: 'p1',
    cid: 'Qm1',
    stellarTxHash: 'txhash1',
    isDeleted: false,
    createdAt: new Date(),
    ...overrides,
  });
}

function makeGrant(overrides: Partial<AccessGrant> = {}): AccessGrant {
  return Object.assign(new AccessGrant(), {
    id: 'grant-1',
    patientId: 'p1',
    granteeId: 'doc1',
    recordIds: ['rec-1'],
    accessLevel: AccessLevel.READ,
    status: GrantStatus.ACTIVE,
    sorobanTxHash: 'txhash-grant',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

// ── Test builder ──────────────────────────────────────────────────────────────

async function buildService(
  recordResult: Record | null,
  grantResult: AccessGrant | null,
): Promise<{ service: StellarStreamService; emitter: EventEmitter2; counter: { inc: jest.Mock } }> {
  const counter = { inc: jest.fn() };
  const emitter = new EventEmitter2();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StellarStreamService,
      {
        provide: getRepositoryToken(Record),
        useValue: { findOne: jest.fn().mockResolvedValue(recordResult) },
      },
      {
        provide: getRepositoryToken(AccessGrant),
        useValue: { findOne: jest.fn().mockResolvedValue(grantResult) },
      },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn().mockImplementation((key: string, def?: any) => {
            if (key === 'STELLAR_NETWORK') return 'testnet';
            if (key === 'STELLAR_CONTRACT_ID') return CONTRACT;
            if (key === 'REDIS_HOST') return 'localhost';
            if (key === 'REDIS_PORT') return 6379;
            return def;
          }),
        },
      },
      { provide: EventEmitter2, useValue: emitter },
      {
        provide: 'PROM_METRIC_MEDCHAIN_STELLAR_STREAM_EVENTS_PROCESSED_TOTAL',
        useValue: counter,
      },
    ],
  }).compile();

  const service = module.get(StellarStreamService);

  // Prevent real Redis / Horizon connections in tests
  jest.spyOn(service as any, '_getCursor').mockResolvedValue('now');
  jest.spyOn(service as any, '_saveCursor').mockResolvedValue(undefined);

  return { service, emitter, counter };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StellarStreamService', () => {
  describe('_handleTransaction — record scenarios', () => {
    it('emits record.anchored and increments confirmed counter on successful tx', async () => {
      const { service, emitter, counter } = await buildService(makeRecord(), null);
      const emitted: any[] = [];
      emitter.on('record.anchored', (e) => emitted.push(e));

      await service._handleTransaction(makeTx({ successful: true }) as any);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ recordId: 'rec-1', txHash: 'txhash1' });
      expect(counter.inc).toHaveBeenCalledWith({ result: 'confirmed' });
    });

    it('emits record.anchor.failed and increments failed counter on unsuccessful tx', async () => {
      const { service, emitter, counter } = await buildService(makeRecord(), null);
      const emitted: any[] = [];
      emitter.on('record.anchor.failed', (e) => emitted.push(e));

      await service._handleTransaction(makeTx({ successful: false }) as any);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ recordId: 'rec-1', txHash: 'txhash1' });
      expect(counter.inc).toHaveBeenCalledWith({ result: 'failed' });
    });
  });

  describe('_handleTransaction — access grant scenarios', () => {
    it('emits access.grant.confirmed on successful grant tx', async () => {
      const { service, emitter, counter } = await buildService(
        null,
        makeGrant({ sorobanTxHash: 'txhash1' }),
      );
      const emitted: any[] = [];
      emitter.on('access.grant.confirmed', (e) => emitted.push(e));

      await service._handleTransaction(makeTx({ successful: true }) as any);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ grantId: 'grant-1', txHash: 'txhash1' });
      expect(counter.inc).toHaveBeenCalledWith({ result: 'confirmed' });
    });

    it('emits access.grant.failed on unsuccessful grant tx', async () => {
      const { service, emitter, counter } = await buildService(
        null,
        makeGrant({ sorobanTxHash: 'txhash1' }),
      );
      const emitted: any[] = [];
      emitter.on('access.grant.failed', (e) => emitted.push(e));

      await service._handleTransaction(makeTx({ successful: false }) as any);

      expect(emitted).toHaveLength(1);
      expect(counter.inc).toHaveBeenCalledWith({ result: 'failed' });
    });
  });

  describe('_handleTransaction — skipped / unknown tx', () => {
    it('increments skipped counter when no matching record or grant', async () => {
      const { service, counter } = await buildService(null, null);

      await service._handleTransaction(makeTx() as any);

      expect(counter.inc).toHaveBeenCalledWith({ result: 'skipped' });
    });

    it('increments skipped counter when tx does not involve the contract', async () => {
      // No matching record/grant, and contract filter returns false
      const { service, counter } = await buildService(null, null);
      jest.spyOn(service as any, '_involvesContract').mockReturnValue(false);

      await service._handleTransaction(makeTx() as any);

      expect(counter.inc).toHaveBeenCalledWith({ result: 'skipped' });
    });
  });

  describe('cursor persistence', () => {
    it('saves the paging_token after processing a tx', async () => {
      const { service } = await buildService(makeRecord(), null);
      const saveSpy = jest.spyOn(service as any, '_saveCursor');

      await service._handleTransaction(makeTx({ paging_token: 'tok-99' }) as any);

      expect(saveSpy).toHaveBeenCalledWith('tok-99');
    });
  });

  describe('error handling', () => {
    it('increments error counter and does not throw when processing throws', async () => {
      const { service, counter } = await buildService(null, null);
      // Force an error inside the handler
      jest.spyOn(service['recordRepo'], 'findOne').mockRejectedValue(new Error('db down'));

      await expect(service._handleTransaction(makeTx() as any)).resolves.not.toThrow();
      expect(counter.inc).toHaveBeenCalledWith({ result: 'error' });
    });
  });

  describe('stream status', () => {
    it('starts in reconnecting state', async () => {
      const { service } = await buildService(null, null);
      expect(service.status).toBe('reconnecting');
    });
  });

  describe('worker restart / catchup replay', () => {
    it('resumes from stored cursor on restart, not from "now"', async () => {
      const { service } = await buildService(null, null);

      // Simulate Redis having a stored cursor from before restart
      const redisMock = (service as any).redis;
      redisMock.mget = jest.fn().mockResolvedValue(['token-42', String(Date.now() - 1000)]);

      const cursor = await service._getCursor();
      expect(cursor).toBe('token-42');
    });

    it('logs a stale cursor warning when cursor is older than 24 hours', async () => {
      const { service } = await buildService(null, null);
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      const staleTs = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      const redisMock = (service as any).redis;
      redisMock.mget = jest.fn().mockResolvedValue(['token-old', String(staleTs)]);

      await service._getCursor();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stale cursor detected'),
      );
    });

    it('does not warn when cursor is fresh (< 24 hours)', async () => {
      const { service } = await buildService(null, null);
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      const freshTs = Date.now() - 60 * 1000; // 1 minute ago
      const redisMock = (service as any).redis;
      redisMock.mget = jest.fn().mockResolvedValue(['token-fresh', String(freshTs)]);

      await service._getCursor();

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('skips duplicate tx on replay without double-emitting events', async () => {
      const { service, emitter, counter } = await buildService(makeRecord(), null);

      // Restore real _getCursor/_saveCursor for this test; mock Redis SET NX
      jest.spyOn(service as any, '_getCursor').mockRestore?.();
      jest.spyOn(service as any, '_saveCursor').mockRestore?.();

      const redisMock = (service as any).redis;
      // First call returns 'OK' (new), second returns null (duplicate)
      redisMock.set = jest.fn()
        .mockResolvedValueOnce('OK')   // first processing
        .mockResolvedValue(null);      // replay attempt — duplicate

      const anchored: any[] = [];
      emitter.on('record.anchored', (e) => anchored.push(e));

      const tx = makeTx({ paging_token: 'tok-1' });

      // First pass: should process and emit
      await service._handleTransaction(tx as any);
      expect(anchored).toHaveLength(1);

      // Second pass (replay): should be deduped, no additional emit
      await service._handleTransaction(tx as any);
      expect(anchored).toHaveLength(1);
      expect(counter.inc).toHaveBeenCalledWith({ result: 'skipped' });
    });

    it('processes all events exactly once across simulated restart', async () => {
      // Simulate: 3 txs processed before restart, then stream restarts from
      // cursor of tx-2 and replays tx-2 and tx-3 before receiving tx-4.
      // Expected: tx-1, tx-2, tx-3 each processed once; tx-4 processed once.
      const recordFindOne = jest.fn().mockResolvedValue(null);
      const grantFindOne = jest.fn().mockResolvedValue(null);
      const counter = { inc: jest.fn() };
      const emitter = new EventEmitter2();

      const module = await Test.createTestingModule({
        providers: [
          StellarStreamService,
          { provide: getRepositoryToken(Record), useValue: { findOne: recordFindOne } },
          { provide: getRepositoryToken(AccessGrant), useValue: { findOne: grantFindOne } },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockImplementation((key: string, def?: any) => {
                if (key === 'STELLAR_NETWORK') return 'testnet';
                if (key === 'STELLAR_CONTRACT_ID') return CONTRACT;
                if (key === 'REDIS_HOST') return 'localhost';
                if (key === 'REDIS_PORT') return 6379;
                return def;
              }),
            },
          },
          { provide: EventEmitter2, useValue: emitter },
          { provide: 'PROM_METRIC_MEDCHAIN_STELLAR_STREAM_EVENTS_PROCESSED_TOTAL', useValue: counter },
        ],
      }).compile();

      const service = module.get(StellarStreamService);

      // In-memory dedup store (mimics Redis SET NX behaviour)
      const seen = new Set<string>();
      const redisMock = (service as any).redis;
      redisMock.set = jest.fn().mockImplementation(
        (_key: string, _val: string, _ex: string, _ttl: number, flag: string) => {
          if (flag !== 'NX') return Promise.resolve('OK');
          const dedupKey = _key;
          if (seen.has(dedupKey)) return Promise.resolve(null); // duplicate
          seen.add(dedupKey);
          return Promise.resolve('OK');
        },
      );
      redisMock.mset = jest.fn().mockResolvedValue('OK');
      jest.spyOn(service as any, '_getCursor').mockResolvedValue('now');
      jest.spyOn(service as any, '_saveCursor').mockResolvedValue(undefined);

      const processOrder: string[] = [];
      counter.inc.mockImplementation(({ result }: { result: string }) => {
        if (result !== 'skipped') processOrder.push(result);
      });

      // Pre-restart: process tx-1, tx-2, tx-3
      for (const token of ['tok-1', 'tok-2', 'tok-3']) {
        await service._handleTransaction(makeTx({ hash: token, paging_token: token }) as any);
      }

      // Post-restart replay: tx-2 and tx-3 replayed, then new tx-4
      for (const token of ['tok-2', 'tok-3', 'tok-4']) {
        await service._handleTransaction(makeTx({ hash: token, paging_token: token }) as any);
      }

      // tx-1, tx-2, tx-3, tx-4 each processed exactly once (4 non-skipped increments)
      expect(processOrder).toHaveLength(4);
      // Replayed tok-2 and tok-3 were deduped (2 skipped increments)
      const skippedCalls = (counter.inc as jest.Mock).mock.calls.filter(
        ([arg]: [{ result: string }]) => arg.result === 'skipped',
      );
      expect(skippedCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('health indicator', () => {
    it('reports connected when status is connected', async () => {
      const { service } = await buildService(null, null);
      service.status = 'connected';

      const { StellarStreamHealthIndicator } = await import('./stellar-stream.health');
      const indicator = new StellarStreamHealthIndicator(service);
      const result = indicator.check('stellarStream');
      expect(result.stellarStream.status).toBe('up');
    });

    it('throws HealthCheckError when status is not connected', async () => {
      const { service } = await buildService(null, null);
      service.status = 'reconnecting';

      const { StellarStreamHealthIndicator } = await import('./stellar-stream.health');
      const { HealthCheckError } = await import('@nestjs/terminus');
      const indicator = new StellarStreamHealthIndicator(service);
      expect(() => indicator.check('stellarStream')).toThrow(HealthCheckError);
    });
  });
});
