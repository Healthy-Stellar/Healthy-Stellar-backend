import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { MultiSigTransactionEntity } from '../entities/multi-sig-transaction.entity';

@Injectable()
export class StellarPaymentService {
  private readonly logger = new Logger(StellarPaymentService.name);

  constructor(
    private readonly stellarService: StellarService,
  ) {}

  async executePayment(tx: MultiSigTransactionEntity): Promise<string> {
    // Use StellarService to submit the transaction
    // This is a placeholder that assumes a simple payment submission
    const txHash = await this.stellarService.sendPayment({
      destination: tx.destination,
      amount: tx.amount,
      asset: tx.asset,
      memo: tx.memo,
    });
    this.logger.log(`Tx executed: ${tx.id}, hash: ${txHash}`);
    return txHash;
  }
}
