import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { context, propagation, trace } from '@opentelemetry/api';
import { QUEUE_NAMES, JOB_TYPES } from '../queue.constants';
import { StellarContractService } from '../../blockchain/stellar-contract.service';

/**
 * ContractWritesProcessor
 *
 * Handles all Soroban smart contract write operations asynchronously
 * These are operations that modify on-chain state (anchorRecord, grantAccess, revokeAccess)
 */
@Processor(QUEUE_NAMES.CONTRACT_WRITES, {
  concurrency: 3, // Lower concurrency for contract writes to handle blockchain rate limits
})
export class ContractWritesProcessor extends WorkerHost {
  private readonly logger = new Logger(ContractWritesProcessor.name);
  private readonly tracer = trace.getTracer('healthy-stellar-backend');

  constructor(
    @Inject(StellarContractService)
    private readonly stellarContractService: StellarContractService,
  ) {
    super();
  }

  /**
   * Process contract write job
   */
  async process(job: Job<any>): Promise<any> {
    const { operationType, params, initiatedBy, correlationId, traceContext } =
      job.data;

    // Extract trace context from job data
    const extractedContext = traceContext
      ? propagation.extract(context.active(), traceContext)
      : context.active();

    return context.with(extractedContext, async () => {
      const span = this.tracer.startSpan('queue.process.contractWrite', {
        attributes: {
          'queue.name': QUEUE_NAMES.CONTRACT_WRITES,
          'queue.job_id': job.id,
          'queue.operation_type': operationType,
          'queue.correlation_id': correlationId,
          'queue.attempt': job.attemptsMade + 1,
          'queue.initiated_by': initiatedBy,
        },
      });

      return context.with(trace.setSpan(context.active(), span), async () => {
        try {
          this.logger.log(
            `[${QUEUE_NAMES.CONTRACT_WRITES}] Processing ${operationType} - Job: ${job.id}, Correlation: ${correlationId}, Attempt: ${job.attemptsMade + 1}`,
          );

          job.progress(10);

          let result;
          switch (operationType) {
            case JOB_TYPES.ANCHOR_RECORD:
              result = await this.executeAnchorRecord(params, job);
              break;

            case JOB_TYPES.GRANT_ACCESS:
              result = await this.executeGrantAccess(params, job);
              break;

            case JOB_TYPES.REVOKE_ACCESS:
              result = await this.executeRevokeAccess(params, job);
              break;

            case JOB_TYPES.VERIFY_ACCESS:
              result = await this.executeVerifyAccess(params, job);
              break;

            default:
              throw new Error(
                `Unknown operation type for contract write: ${operationType}`,
              );
          }

          job.progress(100);
          span.addEvent('queue.job.completed', {
            'queue.result': JSON.stringify(result),
          });

          this.logger.log(
            `[${QUEUE_NAMES.CONTRACT_WRITES}] Job ${job.id} completed successfully`,
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

          // Log with attempt information for retries
          const isLastAttempt = job.attemptsMade >= job.opts.attempts! - 1;
          this.logger.error(
            `[${QUEUE_NAMES.CONTRACT_WRITES}] Job ${job.id} failed on attempt ${job.attemptsMade + 1}/${job.opts.attempts}: ${errorMessage}${isLastAttempt ? ' (FINAL ATTEMPT)' : ''}`,
            errorStack,
          );

          // Re-throw to trigger BullMQ retry/failure handling
          throw error;
        } finally {
          span.end();
        }
      });
    });
  }

  /**
   * Execute anchor record contract call
   */
  private async executeAnchorRecord(params: any, job: Job): Promise<any> {
    this.logger.debug(
      `[AnchorRecord] Starting anchor - patientId: ${params.patientId}, cid: ${params.cid}`,
    );

    job.progress(30);

    const result = await this.stellarContractService.anchorRecord({
      patientId: params.patientId,
      cid: params.cid,
    });

    job.progress(90);

    return {
      status: 'success',
      operation: 'anchorRecord',
      patientId: params.patientId,
      cid: params.cid,
      txHash: result.txHash,
      ledger: result.ledger,
      confirmedAt: result.confirmedAt,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute grant access contract call
   */
  private async executeGrantAccess(params: any, job: Job): Promise<any> {
    this.logger.debug(
      `[GrantAccess] Starting grant - patientId: ${params.patientId}, granteeId: ${params.granteeId}`,
    );

    job.progress(30);

    // Calculate expiration if not provided (default 7 days, in milliseconds)
    const expiresAtMs =
      params.expiresAtMs ||
      BigInt(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await this.stellarContractService.grantAccess({
      patientId: params.patientId,
      granteeId: params.granteeId,
      recordId: params.recordId,
      expiresAtMs: typeof expiresAtMs === 'bigint' ? expiresAtMs : BigInt(expiresAtMs),
    });

    job.progress(90);

    return {
      status: 'success',
      operation: 'grantAccess',
      patientId: params.patientId,
      granteeId: params.granteeId,
      recordId: params.recordId,
      txHash: result.txHash,
      ledger: result.ledger,
      confirmedAt: result.confirmedAt,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute revoke access contract call
   */
  private async executeRevokeAccess(params: any, job: Job): Promise<any> {
    this.logger.debug(
      `[RevokeAccess] Starting revoke - patientId: ${params.patientId}, granteeId: ${params.granteeId}`,
    );

    job.progress(30);

    const result = await this.stellarContractService.revokeAccess({
      patientId: params.patientId,
      granteeId: params.granteeId,
      recordId: params.recordId,
    });

    job.progress(90);

    return {
      status: 'success',
      operation: 'revokeAccess',
      patientId: params.patientId,
      granteeId: params.granteeId,
      recordId: params.recordId,
      txHash: result.txHash,
      ledger: result.ledger,
      confirmedAt: result.confirmedAt,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute verify access contract call (read-only, simulated)
   */
  private async executeVerifyAccess(params: any, job: Job): Promise<any> {
    this.logger.debug(
      `[VerifyAccess] Checking access - requesterId: ${params.requesterId}, recordId: ${params.recordId}`,
    );

    job.progress(30);

    const result = await this.stellarContractService.verifyAccess({
      requesterId: params.requesterId,
      recordId: params.recordId,
    });

    job.progress(90);

    return {
      status: 'success',
      operation: 'verifyAccess',
      requesterId: params.requesterId,
      recordId: params.recordId,
      hasAccess: result.hasAccess,
      expiresAt: result.expiresAt,
      timestamp: new Date().toISOString(),
    };
  }
}
