import { Injectable, Logger } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import { TracingService } from '../../common/services/tracing.service';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server: StellarSdk.Horizon.Server;
  private contract: StellarSdk.Contract;

  constructor(private readonly tracingService: TracingService) {
    const network = process.env.STELLAR_NETWORK || 'testnet';
    const horizonUrl =
      network === 'testnet'
        ? 'https://horizon-testnet.stellar.org'
        : 'https://horizon.stellar.org';

    this.server = new StellarSdk.Horizon.Server(horizonUrl);
    this.contract = new StellarSdk.Contract(
      process.env.STELLAR_CONTRACT_ID || '',
    );
  }

  async anchorCid(patientId: string, cid: string): Promise<string> {
    return this.tracingService.withSpan(
      'stellar.anchorCid',
      async (span) => {
        span.setAttribute('stellar.patient_id', patientId);
        span.setAttribute('stellar.cid', cid);
        span.setAttribute('stellar.network', process.env.STELLAR_NETWORK || 'testnet');

        try {
          const sourceKeypair = StellarSdk.Keypair.fromSecret(
            process.env.STELLAR_SECRET_KEY || '',
          );
          
          // Load account with tracing
          this.tracingService.addEvent('stellar.loadAccount.start');
          const sourceAccount = await this.server.loadAccount(
            sourceKeypair.publicKey(),
          );
          this.tracingService.addEvent('stellar.loadAccount.complete');

          const operation = this.contract.call(
            'anchor_record',
            StellarSdk.nativeToScVal(patientId, { type: 'string' }),
            StellarSdk.nativeToScVal(cid, { type: 'string' }),
          );

          const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase:
              process.env.STELLAR_NETWORK === 'testnet'
                ? StellarSdk.Networks.TESTNET
                : StellarSdk.Networks.PUBLIC,
          })
            .addOperation(operation)
            .setTimeout(30)
            .build();

          transaction.sign(sourceKeypair);

          // Submit transaction with tracing
          this.tracingService.addEvent('stellar.submitTransaction.start');
          const result = await this.server.submitTransaction(transaction);
          this.tracingService.addEvent('stellar.submitTransaction.complete', {
            'stellar.transaction_hash': result.hash,
          });

          span.setAttribute('stellar.transaction_hash', result.hash);
          this.logger.log(`CID anchored on Stellar: ${result.hash}`);
          return result.hash;
        } catch (error) {
          this.tracingService.recordException(error as Error);
          this.logger.error(`Stellar anchoring failed: ${error.message}`);
          throw new Error(`Stellar anchoring failed: ${error.message}`);
        }
      },
    );
  }
}
