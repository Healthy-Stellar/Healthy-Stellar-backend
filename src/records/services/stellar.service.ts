import { Injectable, Logger } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server: StellarSdk.Horizon.Server;
  private contract: StellarSdk.Contract;

  constructor() {
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
    try {
      const sourceKeypair = StellarSdk.Keypair.fromSecret(
        process.env.STELLAR_SECRET_KEY || '',
      );
      const sourceAccount = await this.server.loadAccount(
        sourceKeypair.publicKey(),
      );

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

      const result = await this.server.submitTransaction(transaction);
      this.logger.log(`CID anchored on Stellar: ${result.hash}`);
      return result.hash;
    } catch (error) {
      this.logger.error(`Stellar anchoring failed: ${error.message}`);
      throw new Error(`Stellar anchoring failed: ${error.message}`);
    }
  }
}
