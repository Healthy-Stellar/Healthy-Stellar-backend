import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { context, propagation, trace } from '@opentelemetry/api';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QUEUE_NAMES } from '../queue.constants';
import { verifyQueuePayload } from '../queue-payload.util';
import { DLQ_BACKOFF_TYPE, dlqBackoffStrategy } from '../../dlq/dlq-retry.strategy';
import { RecordEventStoreService } from '../../records/services/record-event-store.service';
import { RecordEventType } from '../../records/entities/record-event.entity';
import { RECORD_DELETED_EVENT } from '../../records/services/record-sync.service';
import { EventIndexingJobDto } from '../dto/event-indexing-job.dto';

/** Shape returned by process() on success. */
export interface EventIndexingResult {
  status: 'success';
  operation: 'indexEvent';
  eventType: string;
  contractAddress: string;
  blockHeight: number | null;
  eventSequence: number | null;
  count: number;
  effects: string[];
  timestamp: string;
}

/**
 * EventIndexingProcessor
 *
 * Consumes jobs from the EVENT_INDEXING BullMQ queue and maps decoded
 * Soroban contract events to off-chain application state changes.
 *
 * Supported event types
 * ─────────────────────
 * ContractEventAnchorRecord
 *   Appends a RECORD_STELLAR_ANCHORED event to the per-record event store,
 *   recording the on-chain txHash and block height.
 *
 * ContractEventRecordDeleted / ContractEventDeleteRecord /
 * ContractEventRecordRemoved / ContractEventRecordDeletedV1 / *deleted*
 *   Emits `chain.record_deleted` (consumed by RecordSyncService to set
 *   isDeleted=true on the records table) and appends RECORD_DELETED to the
 *   event store.
 *
 * ContractEventAccessGranted
 *   Emits `chain.access_granted` for downstream listeners (notifications,
 *   projections, GraphQL subscriptions).
 *
 * ContractEventAccessRevoked
 *   Emits `chain.access_revoked` for downstream listeners.
 *
 * Unknown event types
 *   Logged at debug level and counted as indexed (no-op side effects).
 *
 * Reliability guarantees
 * ──────────────────────
 * • HMAC-SHA256 payload integrity check before any processing.
 * • OpenTelemetry trace context propagated from the producer span.
 * • All side effects are idempotent: duplicate deliveries are safe.
 * • concurrency: 2 — low enough to preserve per-record event ordering
 *   while still allowing parallel processing of unrelated records.
 */
@Processor(QUEUE_NAMES.EVENT_INDEXING, {
  concurrency: 2,
  settings: { backoffStrategies: { [DLQ_BACKOFF_TYPE]: dlqBackoffStrategy } },
})
export class EventIndexingProcessor extends WorkerHost {
  private readonly logger = new Logger(EventIndexingProcessor.name);
  private readonly tracer = trace.getTracer('healthy-stellar-backend');

  constructor(
    private readonly configService: ConfigService,
    private readonly recordEventStore: RecordEventStoreService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  // ── Public entry point ────────────────────────────────────────────────────

  async process(job: Job<EventIndexingJobDto>): Promise<EventIndexingResult> {
    const { eventType, data, contractAddress, correlationId, traceContext } =
      job.data;

    // Integrity check — reject tampered payloads before any processing.
    verifyQueuePayload(job.data, this.configService.getOrThrow<string>('QUEUE_HMAC_SECRET'));

    // Restore the producer's trace context so this span is a child of the
    // originating request trace.
    const extractedContext = traceContext
      ? propagation.extract(context.active(), traceContext)
      : context.active();

    return context.with(extractedContext, async () => {
      const span = this.tracer.startSpan('queue.process.eventIndexing', {
        attributes: {
          'queue.name': QUEUE_NAMES.EVENT_INDEXING,
          'queue.job_id': job.id ?? 'unknown',
          'queue.event_type': eventType ?? 'unknown',
          'queue.correlation_id': correlationId,
          'queue.attempt': job.attemptsMade + 1,
          'blockchain.contract_address': contractAddress,
        },
      });

      return context.with(trace.setSpan(context.active(), span), async () => {
        try {
          this.logger.log(
            `[${QUEUE_NAMES.EVENT_INDEXING}] Processing event — type: ${eventType}, ` +
              `contract: ${contractAddress}, job: ${job.id}, attempt: ${job.attemptsMade + 1}`,
          );

          job.progress(10);

          const result = await this.indexEvent(eventType, data, contractAddress, job);

          job.progress(100);

          span.addEvent('queue.job.completed', {
            'queue.indexed_count': result.count,
            'queue.effects': result.effects.join(','),
          });

          this.logger.log(
            `[${QUEUE_NAMES.EVENT_INDEXING}] Indexed ${result.count} event(s) — ` +
              `effects: [${result.effects.join(', ')}]`,
          );

          return result;
        } catch (error) {
          const errorMessage = (error as Error).message;
          const errorStack = (error as Error).stack;

          span.recordException(error as Error);
          span.addEvent('queue.job.failed', {
            'error.message': errorMessage,
            'error.type': (error as Error).constructor.name,
          });

          const isLastAttempt =
            job.attemptsMade >= (job.opts.attempts ?? 1) - 1;
          this.logger.error(
            `[${QUEUE_NAMES.EVENT_INDEXING}] Job ${job.id} failed on attempt ` +
              `${job.attemptsMade + 1}/${job.opts.attempts}: ${errorMessage}` +
              `${isLastAttempt ? ' (FINAL ATTEMPT — will be captured by DLQ)' : ''}`,
            errorStack,
          );

          // Re-throw so BullMQ can apply retry / DLQ logic.
          throw error;
        } finally {
          span.end();
        }
      });
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Orchestrate event indexing: normalise inputs, apply side effects, and
   * build the result object.
   */
  private async indexEvent(
    eventType: string | null | undefined,
    data: Record<string, any> | null | undefined,
    contractAddress: string,
    job: Job,
  ): Promise<EventIndexingResult> {
    this.logger.debug(
      `[EventIndexingProcessor] indexEvent — type: ${eventType}, contract: ${contractAddress}`,
    );

    job.progress(30);

    // Normalise potentially missing / non-string inputs.
    const safeEventType =
      typeof eventType === 'string' && eventType.length > 0
        ? eventType
        : 'UnknownEvent';
    const safeData =
      data !== null && data !== undefined && typeof data === 'object'
        ? (data as Record<string, any>)
        : {};

    const mapped = await this.applyEventSideEffects(safeEventType, safeData);

    job.progress(90);

    return {
      status: 'success',
      operation: 'indexEvent',
      eventType: safeEventType,
      contractAddress,
      blockHeight: safeData.blockHeight ?? null,
      eventSequence: safeData.eventSequence ?? null,
      count: mapped.indexedCount,
      effects: mapped.effects,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Map a Soroban contract event to one or more off-chain side effects.
   *
   * All branches are idempotent:
   *  - RecordEventStoreService.append() uses a pessimistic write lock and
   *    monotonically increasing sequence numbers, so duplicate appends for
   *    the same (recordId, eventType) are safe.
   *  - RecordSyncService.handleRecordDeleted() checks isDeleted before
   *    updating, so duplicate emissions are no-ops.
   *  - EventEmitter2 emissions are fire-and-forget; listeners are responsible
   *    for their own idempotency.
   */
  private async applyEventSideEffects(
    eventType: string,
    data: Record<string, any>,
  ): Promise<{ indexedCount: number; effects: string[] }> {
    const effects: string[] = [];

    // Extract common fields — tolerant of missing / wrong-type values.
    const recordId =
      typeof data.recordId === 'string' && data.recordId.length > 0
        ? data.recordId
        : null;

    const txHash =
      typeof data.txHash === 'string'
        ? data.txHash
        : typeof data.stellarTxHash === 'string'
          ? data.stellarTxHash
          : null;

    // ── 1. Record anchored on-chain ─────────────────────────────────────────
    // Append RECORD_STELLAR_ANCHORED to the per-record event store so the
    // event-sourced read model reflects the confirmed on-chain state.
    if (eventType === 'ContractEventAnchorRecord' && recordId && txHash) {
      await this.recordEventStore.append(
        recordId,
        RecordEventType.RECORD_STELLAR_ANCHORED,
        {
          stellarTxHash: txHash,
          blockHeight: data.blockHeight ?? null,
          patientId: data.patientId ?? null,
          cid: data.cid ?? null,
        },
      );
      effects.push('record_event_store.append(RECORD_STELLAR_ANCHORED)');

      // Emit domain event for downstream listeners (notifications, projections).
      this.eventEmitter.emit('chain.record_anchored', {
        recordId,
        txHash,
        blockHeight: data.blockHeight ?? null,
        patientId: data.patientId ?? null,
        cid: data.cid ?? null,
      });
      effects.push('event_emitter.emit(chain.record_anchored)');

      return { indexedCount: 1, effects };
    }

    // ── 2. Record deleted on-chain ──────────────────────────────────────────
    // Handle multiple naming conventions emitted by different contract
    // generator versions.
    const isDeleteEvent =
      eventType === 'ContractEventRecordDeleted' ||
      eventType === 'ContractEventDeleteRecord' ||
      eventType === 'ContractEventRecordRemoved' ||
      eventType === 'ContractEventRecordDeletedV1' ||
      eventType.toLowerCase().includes('deleted');

    if (isDeleteEvent && recordId) {
      const deletedAt =
        this.parseEventTimestamp(data.deletedAt ?? data.timestamp) ??
        new Date();

      // Emit the domain event consumed by RecordSyncService to set
      // isDeleted=true on the records table.
      this.eventEmitter.emit(RECORD_DELETED_EVENT, {
        recordId,
        txHash: txHash ?? 'unknown',
        deletedAt,
      });
      effects.push(`event_emitter.emit(${RECORD_DELETED_EVENT})`);

      // Append an immutable RECORD_DELETED event to the event store.
      await this.recordEventStore.append(
        recordId,
        RecordEventType.RECORD_DELETED,
        {
          txHash: txHash ?? null,
          deletedAt: deletedAt.toISOString(),
          blockHeight: data.blockHeight ?? null,
        },
      );
      effects.push('record_event_store.append(RECORD_DELETED)');

      return { indexedCount: 1, effects };
    }

    // ── 3. Access granted on-chain ──────────────────────────────────────────
    // Emit for downstream listeners: notifications, GraphQL subscriptions,
    // access-grant projections. Persistence is handled by those consumers.
    if (eventType === 'ContractEventAccessGranted') {
      this.eventEmitter.emit('chain.access_granted', { ...data });
      effects.push('event_emitter.emit(chain.access_granted)');
      return { indexedCount: 1, effects };
    }

    // ── 4. Access revoked on-chain ──────────────────────────────────────────
    if (eventType === 'ContractEventAccessRevoked') {
      this.eventEmitter.emit('chain.access_revoked', { ...data });
      effects.push('event_emitter.emit(chain.access_revoked)');
      return { indexedCount: 1, effects };
    }

    // ── 5. Unknown / unhandled event type ───────────────────────────────────
    // Log for observability but do not throw — unknown events should not
    // block the queue or trigger retries.
    this.logger.debug(
      `[EventIndexingProcessor] Unhandled eventType="${eventType}" ` +
        `fields=[${Object.keys(data).join(', ')}]`,
    );
    effects.push('noop(unhandled_event_type)');
    return { indexedCount: 1, effects };
  }

  /**
   * Parse a timestamp value from an on-chain event payload.
   * Handles Date objects, Unix epoch numbers (ms), and ISO-8601 strings.
   * Returns null for any unrecognised / invalid value.
   */
  private parseEventTimestamp(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value);
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
}
