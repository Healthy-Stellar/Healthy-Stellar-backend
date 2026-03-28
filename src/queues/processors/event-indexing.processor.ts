import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { context, propagation, trace } from '@opentelemetry/api';
import { QUEUE_NAMES } from '../queue.constants';

/**
 * EventIndexingProcessor
 *
 * Handles indexing of blockchain events from Stellar/Soroban contracts
 * Processes contract events and stores them in the local database for querying
 */
@Processor(QUEUE_NAMES.EVENT_INDEXING, {
  concurrency: 2, // Sequential processing to maintain event ordering
})
export class EventIndexingProcessor extends WorkerHost {
  private readonly logger = new Logger(EventIndexingProcessor.name);
  private readonly tracer = trace.getTracer('healthy-stellar-backend');

  /**
   * Process event indexing job
   */
  async process(job: Job<any>): Promise<any> {
    const { eventType, data, contractAddress, correlationId, traceContext } =
      job.data;

    // Extract trace context from job data
    const extractedContext = traceContext
      ? propagation.extract(context.active(), traceContext)
      : context.active();

    return context.with(extractedContext, async () => {
      const span = this.tracer.startSpan('queue.process.eventIndexing', {
        attributes: {
          'queue.name': QUEUE_NAMES.EVENT_INDEXING,
          'queue.job_id': job.id,
          'queue.event_type': eventType,
          'queue.correlation_id': correlationId,
          'queue.attempt': job.attemptsMade + 1,
          'blockchain.contract_address': contractAddress,
        },
      });

      return context.with(trace.setSpan(context.active(), span), async () => {
        try {
          this.logger.log(
            `[${QUEUE_NAMES.EVENT_INDEXING}] Processing event - Type: ${eventType}, Contract: ${contractAddress}, Job: ${job.id}`,
          );

          job.progress(10);

          const result = await this.indexEvent(eventType, data, contractAddress, job);

          job.progress(100);

          span.addEvent('queue.job.completed', {
            'queue.indexed_records': result.count,
          });

          this.logger.log(
            `[${QUEUE_NAMES.EVENT_INDEXING}] Successfully indexed ${result.count} events`,
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

          const isLastAttempt = job.attemptsMade >= job.opts.attempts! - 1;
          this.logger.error(
            `[${QUEUE_NAMES.EVENT_INDEXING}] Job ${job.id} failed on attempt ${job.attemptsMade + 1}/${job.opts.attempts}: ${errorMessage}${isLastAttempt ? ' (FINAL ATTEMPT)' : ''}`,
            errorStack,
          );

          throw error;
        } finally {
          span.end();
        }
      });
    });
  }

  /**
   * Index contract event data
   */
  private async indexEvent(
    eventType: string,
    data: any,
    contractAddress: string,
    job: Job,
  ): Promise<any> {
    this.logger.debug(
      `[Event Indexing] Indexing event - Type: ${eventType}, Contract: ${contractAddress}`,
    );

    job.progress(30);

    // TODO: Implement actual event indexing logic
    // This should:
    // 1. Parse contract event data (XDR)
    // 2. Store in database
    // 3. Trigger downstream notifications/state updates
    // 4. Update block height markers
    // 5. Handle event deduplication

    // Simulate event processing
    await this.simulateEventIndexing(eventType, data);

    job.progress(90);

    return {
      status: 'success',
      operation: 'indexEvent',
      eventType,
      contractAddress,
      blockHeight: data.blockHeight || null,
      eventSequence: data.eventSequence || null,
      count: 1, // Number of indexed events
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Simulate event indexing (replace with actual implementation)
   */
  private async simulateEventIndexing(
    eventType: string,
    data: any,
  ): Promise<void> {
    // In production, this would:
    // - Parse XDR event data
    // - Extract field values
    // - Store in database
    // - Emit internal events

    // Simulate processing based on event type
    const processingTime = eventType === 'ContractEventAccessRevoked' ? 1500 : 1000;

    return new Promise((resolve) => {
      setTimeout(() => {
        this.logger.debug(
          `Indexed event: ${eventType} with ${Object.keys(data).length} fields`,
        );
        resolve();
      }, processingTime);
    });
  }
}
