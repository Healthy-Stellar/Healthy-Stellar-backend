import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventIndexingProcessor } from './event-indexing.processor';
import { RecordEventStoreService } from '../../records/services/record-event-store.service';
import { RecordEventType } from '../../records/entities/record-event.entity';
import { RECORD_DELETED_EVENT } from '../../records/services/record-sync.service';

// ── Mock the HMAC utility so tests don't need a real secret ──────────────────
jest.mock('../queue-payload.util', () => ({
  verifyQueuePayload: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal BullMQ Job mock. */
function makeJob(overrides: Partial<{
  id: string;
  data: Record<string, any>;
  attemptsMade: number;
  attempts: number;
}> = {}): any {
  return {
    id: overrides.id ?? 'job-001',
    data: overrides.data ?? {
      eventType: 'ContractEventAnchorRecord',
      contractAddress: 'CAAAA...',
      data: {
        blockHeight: 12345,
        eventSequence: 1,
        recordId: 'rec-123',
        txHash: 'tx-abc',
        patientId: 'pat-123',
        cid: 'Qm...',
      },
      correlationId: 'corr-001',
      traceContext: {},
      _sig: 'test-sig',
    },
    attemptsMade: overrides.attemptsMade ?? 0,
    opts: { attempts: overrides.attempts ?? 3 },
    progress: jest.fn(),
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('EventIndexingProcessor', () => {
  let processor: EventIndexingProcessor;
  let recordEventStore: jest.Mocked<Pick<RecordEventStoreService, 'append'>>;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;

  beforeEach(async () => {
    recordEventStore = { append: jest.fn().mockResolvedValue(undefined) };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventIndexingProcessor,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-hmac-secret') },
        },
        { provide: RecordEventStoreService, useValue: recordEventStore },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    processor = module.get<EventIndexingProcessor>(EventIndexingProcessor);

    // Suppress log output during tests.
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── ContractEventAnchorRecord ─────────────────────────────────────────────

  describe('ContractEventAnchorRecord', () => {
    it('returns a success result with correct shape', async () => {
      const job = makeJob();
      const result = await processor.process(job);

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          operation: 'indexEvent',
          eventType: 'ContractEventAnchorRecord',
          contractAddress: 'CAAAA...',
          count: 1,
          blockHeight: 12345,
          eventSequence: 1,
        }),
      );
      expect(result.timestamp).toBeDefined();
    });

    it('appends RECORD_STELLAR_ANCHORED to the event store', async () => {
      const job = makeJob();
      await processor.process(job);

      expect(recordEventStore.append).toHaveBeenCalledWith(
        'rec-123',
        RecordEventType.RECORD_STELLAR_ANCHORED,
        expect.objectContaining({ stellarTxHash: 'tx-abc' }),
      );
    });

    it('emits chain.record_anchored domain event', async () => {
      const job = makeJob();
      await processor.process(job);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'chain.record_anchored',
        expect.objectContaining({ recordId: 'rec-123', txHash: 'tx-abc' }),
      );
    });

    it('falls through to noop when recordId is missing', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAnchorRecord',
          contractAddress: 'CAAAA...',
          data: { txHash: 'tx-abc', blockHeight: 100 }, // no recordId
          correlationId: 'corr-002',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.status).toBe('success');
      expect(recordEventStore.append).not.toHaveBeenCalled();
    });

    it('falls through to noop when txHash is missing', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAnchorRecord',
          contractAddress: 'CAAAA...',
          data: { recordId: 'rec-123', blockHeight: 100 }, // no txHash
          correlationId: 'corr-003',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.status).toBe('success');
      expect(recordEventStore.append).not.toHaveBeenCalled();
    });

    it('accepts stellarTxHash as an alias for txHash', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAnchorRecord',
          contractAddress: 'CAAAA...',
          data: { recordId: 'rec-123', stellarTxHash: 'tx-alias', blockHeight: 200 },
          correlationId: 'corr-004',
          traceContext: {},
          _sig: 'sig',
        },
      });

      await processor.process(job);

      expect(recordEventStore.append).toHaveBeenCalledWith(
        'rec-123',
        RecordEventType.RECORD_STELLAR_ANCHORED,
        expect.objectContaining({ stellarTxHash: 'tx-alias' }),
      );
    });
  });

  // ── ContractEventRecordDeleted ────────────────────────────────────────────

  describe('ContractEventRecordDeleted (and variants)', () => {
    const deleteEventTypes = [
      'ContractEventRecordDeleted',
      'ContractEventDeleteRecord',
      'ContractEventRecordRemoved',
      'ContractEventRecordDeletedV1',
      'ContractEventSomeDeletedVariant', // matches .includes('deleted')
    ];

    it.each(deleteEventTypes)(
      'handles %s — emits chain.record_deleted and appends RECORD_DELETED',
      async (eventType) => {
        const job = makeJob({
          data: {
            eventType,
            contractAddress: 'CBBBB...',
            data: { recordId: 'rec-del-1', txHash: 'tx-del', blockHeight: 500 },
            correlationId: 'corr-del',
            traceContext: {},
            _sig: 'sig',
          },
        });

        const result = await processor.process(job);

        expect(result.status).toBe('success');
        expect(result.count).toBe(1);

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          RECORD_DELETED_EVENT,
          expect.objectContaining({ recordId: 'rec-del-1' }),
        );

        expect(recordEventStore.append).toHaveBeenCalledWith(
          'rec-del-1',
          RecordEventType.RECORD_DELETED,
          expect.objectContaining({ txHash: 'tx-del' }),
        );
      },
    );

    it('uses current date when deletedAt is absent', async () => {
      const before = Date.now();
      const job = makeJob({
        data: {
          eventType: 'ContractEventRecordDeleted',
          contractAddress: 'CBBBB...',
          data: { recordId: 'rec-del-2' }, // no deletedAt
          correlationId: 'corr-del-2',
          traceContext: {},
          _sig: 'sig',
        },
      });

      await processor.process(job);

      const emitCall = (eventEmitter.emit as jest.Mock).mock.calls.find(
        ([name]) => name === RECORD_DELETED_EVENT,
      );
      expect(emitCall).toBeDefined();
      const deletedAt: Date = emitCall[1].deletedAt;
      expect(deletedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('parses ISO-8601 deletedAt string', async () => {
      const isoDate = '2024-06-01T12:00:00.000Z';
      const job = makeJob({
        data: {
          eventType: 'ContractEventRecordDeleted',
          contractAddress: 'CBBBB...',
          data: { recordId: 'rec-del-3', deletedAt: isoDate },
          correlationId: 'corr-del-3',
          traceContext: {},
          _sig: 'sig',
        },
      });

      await processor.process(job);

      const emitCall = (eventEmitter.emit as jest.Mock).mock.calls.find(
        ([name]) => name === RECORD_DELETED_EVENT,
      );
      expect(emitCall[1].deletedAt).toEqual(new Date(isoDate));
    });

    it('falls through to noop when recordId is missing', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventRecordDeleted',
          contractAddress: 'CBBBB...',
          data: { txHash: 'tx-del' }, // no recordId
          correlationId: 'corr-del-4',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.status).toBe('success');
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        RECORD_DELETED_EVENT,
        expect.anything(),
      );
      expect(recordEventStore.append).not.toHaveBeenCalled();
    });
  });

  // ── ContractEventAccessGranted ────────────────────────────────────────────

  describe('ContractEventAccessGranted', () => {
    it('emits chain.access_granted with full event data', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAccessGranted',
          contractAddress: 'CCCCC...',
          data: {
            recordId: 'rec-456',
            patientId: 'pat-456',
            granteeId: 'grantee-789',
            expirationTime: 9999999999,
            blockHeight: 600,
          },
          correlationId: 'corr-grant',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.status).toBe('success');
      expect(result.eventType).toBe('ContractEventAccessGranted');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'chain.access_granted',
        expect.objectContaining({
          recordId: 'rec-456',
          granteeId: 'grantee-789',
        }),
      );
    });

    it('does not write to the event store', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAccessGranted',
          contractAddress: 'CCCCC...',
          data: { recordId: 'rec-456', granteeId: 'grantee-789' },
          correlationId: 'corr-grant-2',
          traceContext: {},
          _sig: 'sig',
        },
      });

      await processor.process(job);

      expect(recordEventStore.append).not.toHaveBeenCalled();
    });
  });

  // ── ContractEventAccessRevoked ────────────────────────────────────────────

  describe('ContractEventAccessRevoked', () => {
    it('emits chain.access_revoked with full event data', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAccessRevoked',
          contractAddress: 'CDDDD...',
          data: {
            recordId: 'rec-789',
            granteeId: 'grantee-456',
            blockHeight: 12346,
          },
          correlationId: 'corr-revoke',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          eventType: 'ContractEventAccessRevoked',
        }),
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'chain.access_revoked',
        expect.objectContaining({ recordId: 'rec-789' }),
      );
    });

    it('does not write to the event store', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAccessRevoked',
          contractAddress: 'CDDDD...',
          data: { recordId: 'rec-789', granteeId: 'grantee-456' },
          correlationId: 'corr-revoke-2',
          traceContext: {},
          _sig: 'sig',
        },
      });

      await processor.process(job);

      expect(recordEventStore.append).not.toHaveBeenCalled();
    });
  });

  // ── Unknown / unhandled event types ──────────────────────────────────────

  describe('Unknown event types', () => {
    it('returns success without side effects for an unknown event type', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventSomeFutureEvent',
          contractAddress: 'CEEEE...',
          data: { someField: 'someValue' },
          correlationId: 'corr-unknown',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.status).toBe('success');
      expect(result.count).toBe(1);
      expect(result.effects).toContain('noop(unhandled_event_type)');
      expect(recordEventStore.append).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('handles null eventType gracefully', async () => {
      const job = makeJob({
        data: {
          eventType: null,
          contractAddress: 'CEEEE...',
          data: {},
          correlationId: 'corr-null-type',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.status).toBe('success');
      expect(result.eventType).toBe('UnknownEvent');
    });
  });

  // ── Progress tracking ─────────────────────────────────────────────────────

  describe('Progress tracking', () => {
    it('reports progress at 10, 30, 90, and 100', async () => {
      const job = makeJob();
      await processor.process(job);

      expect(job.progress).toHaveBeenCalledWith(10);
      expect(job.progress).toHaveBeenCalledWith(30);
      expect(job.progress).toHaveBeenCalledWith(90);
      expect(job.progress).toHaveBeenCalledWith(100);
    });
  });

  // ── Result shape ──────────────────────────────────────────────────────────

  describe('Result shape', () => {
    it('includes blockHeight and eventSequence from event data', async () => {
      const job = makeJob();
      const result = await processor.process(job);

      expect(result.blockHeight).toBe(12345);
      expect(result.eventSequence).toBe(1);
    });

    it('returns null for missing blockHeight', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAnchorRecord',
          contractAddress: 'CAAAA...',
          data: { eventSequence: 1, patientId: 'pat-123' }, // no blockHeight
          correlationId: 'corr-no-bh',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.blockHeight).toBeNull();
      expect(result.status).toBe('success');
    });

    it('returns null for missing eventSequence', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAnchorRecord',
          contractAddress: 'CAAAA...',
          data: { blockHeight: 12345, patientId: 'pat-123' }, // no eventSequence
          correlationId: 'corr-no-seq',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.eventSequence).toBeNull();
      expect(result.status).toBe('success');
    });

    it('returns timestamp in ISO 8601 format', async () => {
      const job = makeJob();
      const result = await processor.process(job);

      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
      );
    });

    it('preserves contractAddress in result', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAnchorRecord',
          contractAddress: 'CBBBB...',
          data: { recordId: 'rec-123', txHash: 'tx-abc' },
          correlationId: 'corr-addr',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.contractAddress).toBe('CBBBB...');
    });
  });

  // ── Resilience / edge cases ───────────────────────────────────────────────

  describe('Resilience', () => {
    it('handles undefined event data without throwing', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAnchorRecord',
          contractAddress: 'CAAAA...',
          data: undefined,
          correlationId: 'corr-undef',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.status).toBe('success');
    });

    it('handles null event data without throwing', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAnchorRecord',
          contractAddress: 'CAAAA...',
          data: null,
          correlationId: 'corr-null',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.status).toBe('success');
    });

    it('handles complex nested event data', async () => {
      const job = makeJob({
        data: {
          eventType: 'ContractEventAnchorRecord',
          contractAddress: 'CAAAA...',
          data: {
            blockHeight: 12345,
            eventSequence: 5,
            recordId: 'rec-complex',
            txHash: 'tx-complex',
            patientId: 'pat-123',
            cid: 'QmComplex...',
            granteeId: 'grantee-456',
            expirationTime: 1234567890,
            nested: { field: 'value' },
          },
          correlationId: 'corr-complex',
          traceContext: {},
          _sig: 'sig',
        },
      });

      const result = await processor.process(job);

      expect(result.status).toBe('success');
      expect(result.blockHeight).toBe(12345);
      expect(result.eventSequence).toBe(5);
    });

    it('re-throws errors from the event store so BullMQ can retry', async () => {
      const storeError = new Error('DB connection lost');
      recordEventStore.append.mockRejectedValueOnce(storeError);

      const job = makeJob(); // ContractEventAnchorRecord with recordId + txHash

      await expect(processor.process(job)).rejects.toThrow('DB connection lost');
    });

    it('re-throws errors from the event emitter so BullMQ can retry', async () => {
      const emitError = new Error('EventEmitter failure');
      (eventEmitter.emit as jest.Mock).mockImplementationOnce(() => {
        throw emitError;
      });

      const job = makeJob({
        data: {
          eventType: 'ContractEventAccessRevoked',
          contractAddress: 'CDDDD...',
          data: { recordId: 'rec-789', granteeId: 'grantee-456' },
          correlationId: 'corr-emit-err',
          traceContext: {},
          _sig: 'sig',
        },
      });

      await expect(processor.process(job)).rejects.toThrow('EventEmitter failure');
    });

    it('processes multiple event types sequentially without interference', async () => {
      const eventTypes = [
        'ContractEventAnchorRecord',
        'ContractEventAccessGranted',
        'ContractEventAccessRevoked',
      ];

      for (const eventType of eventTypes) {
        const job = makeJob({
          data: {
            eventType,
            contractAddress: 'CAAAA...',
            data: {
              recordId: 'rec-123',
              txHash: 'tx-abc',
              granteeId: 'grantee-456',
              blockHeight: 100,
            },
            correlationId: `corr-${eventType}`,
            traceContext: {},
            _sig: 'sig',
          },
        });

        const result = await processor.process(job);

        expect(result.eventType).toBe(eventType);
        expect(result.status).toBe('success');
      }
    });

    it('succeeds on a high attempt count (retry scenario)', async () => {
      const job = makeJob({ attemptsMade: 2, attempts: 3 });
      const result = await processor.process(job);

      expect(result.status).toBe('success');
    });
  });

  // ── Correlation ID passthrough ────────────────────────────────────────────

  describe('Correlation ID', () => {
    it('preserves correlationId in job data throughout processing', async () => {
      const job = makeJob();
      await processor.process(job);

      // correlationId is not returned in the result (by design — avoids leaking
      // internal identifiers in the job return value), but it must remain intact
      // in the job data for tracing and DLQ capture.
      expect(job.data.correlationId).toBe('corr-001');
    });
  });
});
