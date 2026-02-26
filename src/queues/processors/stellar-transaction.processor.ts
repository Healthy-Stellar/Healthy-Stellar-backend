import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { context, propagation, trace } from '@opentelemetry/api';
import { QUEUE_NAMES, JOB_TYPES } from '../queue.constants';
import { StellarTransactionJobDto } from '../dto/stellar-transaction-job.dto';

@Processor(QUEUE_NAMES.STELLAR_TRANSACTIONS, {
  concurrency: 5,
})
export class StellarTransactionProcessor extends WorkerHost {
  private readonly logger = new Logger(StellarTransactionProcessor.name);
  private readonly tracer = trace.getTracer('healthy-stellar-backend');

  async process(job: Job<StellarTransactionJobDto>): Promise<any> {
    const { operationType, params, initiatedBy, correlationId, traceContext } = job.data;

    // Extract trace context from job data
    const extractedContext = traceContext
      ? propagation.extract(context.active(), traceContext)
      : context.active();

    return context.with(extractedContext, () => {
      const span = this.tracer.startSpan('queue.process.stellarTransaction', {
        attributes: {
          'queue.name': QUEUE_NAMES.STELLAR_TRANSACTIONS,
          'queue.job_id': job.id,
          'queue.operation_type': operationType,
          'queue.correlation_id': correlationId,
          'queue.attempt': job.attemptsMade,
        },
      });

      return context.with(trace.setSpan(context.active(), span), async () => {
        try {
          this.logger.log(
            `Processing ${operationType} job ${job.id} (correlation: ${correlationId}, traceId: ${span.spanContext().traceId})`,
          );

          let result;
          switch (operationType) {
            case JOB_TYPES.ANCHOR_RECORD:
              result = await this.handleAnchorRecord(params, initiatedBy);
              break;
            case JOB_TYPES.GRANT_ACCESS:
              result = await this.handleGrantAccess(params, initiatedBy);
              break;
            case JOB_TYPES.REVOKE_ACCESS:
              result = await this.handleRevokeAccess(params, initiatedBy);
              break;
            default:
              throw new Error(`Unknown operation type: ${operationType}`);
          }

          span.addEvent('queue.job.completed');
          span.end();
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.end();
          this.logger.error(
            `Job ${job.id} failed: ${error.message}`,
            error.stack,
          );
          throw error;
        }
      });
    });
  }

  private async handleAnchorRecord(params: any, initiatedBy: string) {
    this.logger.log(`Anchoring record to Stellar blockchain`);
    // TODO: Implement Stellar smart contract interaction
    await this.simulateBlockchainOperation();
    return { txHash: 'mock_tx_hash', status: 'anchored' };
  }

  private async handleGrantAccess(params: any, initiatedBy: string) {
    this.logger.log(`Granting access on Stellar blockchain`);
    // TODO: Implement Stellar smart contract interaction
    await this.simulateBlockchainOperation();
    return { txHash: 'mock_tx_hash', status: 'access_granted' };
  }

  private async handleRevokeAccess(params: any, initiatedBy: string) {
    this.logger.log(`Revoking access on Stellar blockchain`);
    // TODO: Implement Stellar smart contract interaction
    await this.simulateBlockchainOperation();
    return { txHash: 'mock_tx_hash', status: 'access_revoked' };
  }

  private async simulateBlockchainOperation(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
