import { IsString, IsNotEmpty, IsObject, IsOptional, IsNumber } from 'class-validator';

/**
 * Typed payload for EVENT_INDEXING queue jobs.
 *
 * Dispatched by QueueService.dispatchEventIndexing() and consumed by
 * EventIndexingProcessor. The `data` field carries the decoded Soroban
 * contract event payload; its shape varies by eventType.
 */
export class EventIndexingJobDto {
  /**
   * Soroban contract event name, e.g. "ContractEventAnchorRecord".
   * Maps to a specific handler branch inside EventIndexingProcessor.
   */
  @IsString()
  @IsNotEmpty()
  eventType: string;

  /**
   * Bech32m contract address (C…) that emitted the event.
   */
  @IsString()
  @IsNotEmpty()
  contractAddress: string;

  /**
   * Decoded event payload. Shape depends on eventType:
   *
   * ContractEventAnchorRecord:
   *   { recordId, txHash, patientId, cid, blockHeight, eventSequence }
   *
   * ContractEventRecordDeleted / ContractEventDeleteRecord:
   *   { recordId, txHash?, deletedAt?, timestamp?, blockHeight, eventSequence }
   *
   * ContractEventAccessGranted:
   *   { recordId, patientId, granteeId, expirationTime?, blockHeight, eventSequence }
   *
   * ContractEventAccessRevoked:
   *   { recordId, granteeId, blockHeight, eventSequence }
   */
  @IsObject()
  data: Record<string, any>;

  /**
   * Correlation ID linking this job to the originating HTTP request or
   * upstream job. Used for idempotency and distributed tracing.
   */
  @IsString()
  @IsNotEmpty()
  correlationId: string;

  /**
   * OpenTelemetry W3C trace context propagated from the producer.
   * Allows the processor span to be a child of the originating trace.
   */
  @IsOptional()
  @IsObject()
  traceContext?: Record<string, string>;

  /**
   * HMAC-SHA256 integrity signature added by QueueService.
   * Verified by EventIndexingProcessor before any processing begins.
   */
  @IsString()
  @IsNotEmpty()
  _sig: string;
}
