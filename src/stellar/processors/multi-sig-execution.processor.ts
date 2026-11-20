import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { MultiSigTransactionService } from '../services/multi-sig-transaction.service';
import {
  MULTI_SIG_EXECUTE_JOB,
  MULTI_SIG_EXECUTION_QUEUE,
  MultiSigExecutionJob,
} from '../multi-sig.constants';

@Processor(MULTI_SIG_EXECUTION_QUEUE)
export class MultiSigExecutionProcessor {
  private readonly logger = new Logger(MultiSigExecutionProcessor.name);

  constructor(private readonly multiSigService: MultiSigTransactionService) {}

  @Process(MULTI_SIG_EXECUTE_JOB)
  async handle(job: MultiSigExecutionJob): Promise<void> {
    const transactionId = job.data?.transactionId;
    if (!transactionId) {
      this.logger.error(`Job ${job.id} has no transactionId — discarding`);
      return;
    }

    this.logger.log(`Processing multi-sig transaction ${transactionId}`);
    try {
      // Failures are recorded on the entity (lastError / status); retryable
      // ones stay APPROVED and are re-enqueued by MultiSigSweepTask.
      await this.multiSigService.executeApprovedTransaction(transactionId);
    } catch (error) {
      this.logger.error(`Failed to execute tx ${transactionId}: ${error.message}`);
    }
  }
}
