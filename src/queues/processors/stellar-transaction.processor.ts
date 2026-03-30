import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Job } from 'bullmq';
import { context, propagation, trace } from '@opentelemetry/api';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { QUEUE_NAMES, JOB_TYPES } from '../queue.constants';
import { StellarTransactionJobDto } from '../dto/stellar-transaction-job.dto';
import { StellarContractService } from '../../blockchain/stellar-contract.service';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

@Processor(QUEUE_NAMES.STELLAR_TRANSACTIONS, {
  concurrency: 5,
})
export class StellarTransactionProcessor extends WorkerHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StellarTransactionProcessor.name);
  private readonly tracer = trace.getTracer('healthy-stellar-backend');
  private redis: Redis;

  constructor(
    @Inject(StellarContractService)
    private readonly stellarContractService: StellarContractService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  onModuleInit(): void {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      maxRetriesPerRequest: null,
    });
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
  }

  private idempotencyKey(correlationId: string): string {
    return `stellar:idempotency:${correlationId}`;
  }

  private async getCachedResult(correlationId: string): Promise<any | null> {
    const raw = await this.redis.get(this.idempotencyKey(correlationId));
    return raw ? JSON.parse(raw) : null;
  }

  private async cacheResult(correlationId: string, result: any): Promise<void> {
    await this.redis.set(
      this.idempotencyKey(correlationId),
      JSON.stringify(result),
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
    );
  }

  async process(job: Job<StellarTransactionJobDto>): Promise<any> {
    const { operationType, params, initiatedBy, correlationId, traceContext } = job.data;

    // Idempotency check — short-circuit if this correlationId already succeeded
    const cached = await this.getCachedResult(correlationId);
    if (cached) {
      this.logger.log(`[Idempotency] Returning cached result for correlation: ${correlationId}`);
      return cached;
    }

    // Extract trace context from job data
    const extractedContext = traceContext
      ? propagation.extract(context.active(), traceContext)
      : context.active();

    return context.with(extractedContext, async () => {
      const span = this.tracer.startSpan('queue.process.stellarTransaction', {
        attributes: {
          'queue.name': QUEUE_NAMES.STELLAR_TRANSACTIONS,
          'queue.job_id': job.id,
          'queue.operation_type': operationType,
          'queue.correlation_id': correlationId,
          'queue.attempt': job.attemptsMade,
          'queue.initiated_by': initiatedBy,
        },
      });

      return context.with(trace.setSpan(context.active(), span), async () => {
        try {
          this.logger.log(
            `Processing ${operationType} job ${job.id} (correlation: ${correlationId}, traceId: ${span.spanContext().traceId})`,
          );

          job.progress(10);

          let result;
          switch (operationType) {
            case JOB_TYPES.ANCHOR_RECORD:
              result = await this.handleAnchorRecord(params, initiatedBy, job);
              break;
            case JOB_TYPES.GRANT_ACCESS:
              result = await this.handleGrantAccess(params, initiatedBy, job);
              break;
            case JOB_TYPES.REVOKE_ACCESS:
              result = await this.handleRevokeAccess(params, initiatedBy, job);
              break;
            default:
              throw new Error(`Unknown operation type: ${operationType}`);
          }

          await this.cacheResult(correlationId, result);

          span.addEvent('queue.job.completed', {
            'queue.result': JSON.stringify(result),
          });
          this.logger.log(
            `Job ${job.id} completed successfully - ${operationType}`,
          );

          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.addEvent('queue.job.failed', {
            'error.message': (error as Error).message,
            'error.stack': (error as Error).stack,
          });

          this.logger.error(
            `Job ${job.id} failed on attempt ${job.attemptsMade + 1}: ${(error as Error).message}`,
            (error as Error).stack,
          );
          throw error;
        } finally {
          span.end();
        }
      });
    });
  }

  private async handleAnchorRecord(
    params: any,
    initiatedBy: string,
    job: Job,
  ): Promise<any> {
    this.logger.log(
      `[AnchorRecord] Anchoring record - patientId: ${params.patientId}, cid: ${params.cid}`,
    );
    job.progress(30);

    const result = await this.stellarContractService.anchorRecord({
      patientId: params.patientId,
      cid: params.cid,
    });

    job.progress(90);
    this.logger.log(
      `[AnchorRecord] Successfully anchored record - patientId: ${params.patientId}`,
    );

    return {
      txHash: result.txHash || 'unknown',
      status: 'anchored',
      patientId: params.patientId,
      cid: params.cid,
      timestamp: new Date().toISOString(),
    };
  }

  private async handleGrantAccess(
    params: any,
    initiatedBy: string,
    job: Job,
  ): Promise<any> {
    this.logger.log(
      `[GrantAccess] Granting access - patientId: ${params.patientId}, granteeId: ${params.granteeId}, recordId: ${params.recordId}`,
    );
    job.progress(30);

    const result = await this.stellarContractService.grantAccess({
      patientId: params.patientId,
      granteeId: params.granteeId,
      recordId: params.recordId,
      expirationTime: params.expirationTime || Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days default
    });

    job.progress(90);
    this.logger.log(
      `[GrantAccess] Successfully granted access - patientId: ${params.patientId}, granteeId: ${params.granteeId}`,
    );

    return {
      txHash: result.txHash || 'unknown',
      status: 'access_granted',
      patientId: params.patientId,
      granteeId: params.granteeId,
      recordId: params.recordId,
      timestamp: new Date().toISOString(),
    };
  }

  private async handleRevokeAccess(
    params: any,
    initiatedBy: string,
    job: Job,
  ): Promise<any> {
    this.logger.log(
      `[RevokeAccess] Revoking access - patientId: ${params.patientId}, granteeId: ${params.granteeId}, recordId: ${params.recordId}`,
    );
    job.progress(30);

    const result = await this.stellarContractService.revokeAccess({
      patientId: params.patientId,
      granteeId: params.granteeId,
      recordId: params.recordId,
    });

    job.progress(90);
    this.logger.log(
      `[RevokeAccess] Successfully revoked access - patientId: ${params.patientId}, granteeId: ${params.granteeId}`,
    );

    return {
      txHash: result.txHash || 'unknown',
      status: 'access_revoked',
      patientId: params.patientId,
      granteeId: params.granteeId,
      recordId: params.recordId,
      timestamp: new Date().toISOString(),
    };
  }
}
