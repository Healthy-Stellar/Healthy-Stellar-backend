import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { MultiSigTransactionService } from '../services/multi-sig-transaction.service';

@Processor('multi-sig-execution')
export class MultiSigExecutionProcessor {
  private readonly logger = new Logger(MultiSigExecutionProcessor.name);

  constructor(
    private readonly multiSigService: MultiSigTransactionService,
  ) {}

  @Process()
  async handle(job: { transactionId: string }): Promise<void> {
    this.logger.log(`Processing multi-sig transaction ${job.transactionId}`);
    try {
      await this.multiSigService.executeApprovedTransaction(job.transactionId);
    } catch (error) {
      this.logger.error(`Failed to execute tx ${job.transactionId}: ${error.message}`);
    }
  }
}
