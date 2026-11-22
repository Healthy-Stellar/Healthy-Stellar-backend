import { Injectable, Logger } from '@nestjs/common';
import { StellarService, StellarPaymentError } from './stellar.service';
import { MultiSigTransactionEntity } from '../entities/multi-sig-transaction.entity';

@Injectable()
export class StellarPaymentService {
  private readonly logger = new Logger(StellarPaymentService.name);

  constructor(private readonly stellarService: StellarService) {}

  /**
   * Submit the payment described by an approved multi-sig transaction and
   * return the on-chain transaction hash.
   *
   * Idempotent across retries. When `tx.xdr` holds a previously signed
   * envelope, that exact envelope is resubmitted, so a lost response can't
   * produce a second payment. A new envelope is built only when there is none
   * or the stored one expired without landing (`tx_too_late`). New envelopes
   * go to `persistXdr` before they are submitted.
   */
  async executePayment(
    tx: MultiSigTransactionEntity,
    persistXdr?: (xdr: string) => Promise<void>,
  ): Promise<string> {
    if (tx.xdr) {
      try {
        const hash = await this.stellarService.submitSignedTransaction(tx.xdr);
        this.logger.log(`Tx executed (resubmitted envelope): ${tx.id}, hash: ${hash}`);
        return hash;
      } catch (err) {
        if (!(err instanceof StellarPaymentError) || err.code !== 'tx_too_late') {
          throw err;
        }
        this.logger.warn(`Stored envelope for ${tx.id} expired before landing — rebuilding`);
      }
    }

    const signed = await this.stellarService.buildPaymentTransaction({
      destination: tx.destination,
      amount: tx.amount,
      asset: tx.asset,
      memo: tx.memo,
    });
    if (persistXdr) {
      await persistXdr(signed.xdr);
    }

    const hash = await this.stellarService.submitSignedTransaction(signed.xdr);
    this.logger.log(`Tx executed: ${tx.id}, hash: ${hash}`);
    return hash;
  }
}
