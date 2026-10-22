import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Keypair,
  Networks,
  TransactionBuilder,
  Contract,
  nativeToScVal,
  rpc as SorobanRpc,
  xdr,
} from '@stellar/stellar-sdk';
import { AccessGrant } from '../entities/access-grant.entity';

@Injectable()
export class SorobanQueueService {
  private readonly logger = new Logger(SorobanQueueService.name);
  private readonly server: SorobanRpc.Server;
  private readonly networkPassphrase: string;
  private readonly contractId: string;
  private readonly sourceKeypair: Keypair;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = this.config.get<string>('SOROBAN_RPC_URL');
    this.networkPassphrase =
      this.config.get<string>('STELLAR_NETWORK_PASSPHRASE') ?? Networks.TESTNET;
    this.contractId = this.config.get<string>('SOROBAN_ACCESS_CONTRACT_ID') ?? '';

    const secret = this.config.get<string>('SOROBAN_SOURCE_SECRET');
    if (!rpcUrl || !secret || !this.contractId) {
      throw new Error(
        'SorobanQueueService misconfigured: SOROBAN_RPC_URL, SOROBAN_SOURCE_SECRET and SOROBAN_ACCESS_CONTRACT_ID are required',
      );
    }

    this.server = new SorobanRpc.Server(rpcUrl);
    this.sourceKeypair = Keypair.fromSecret(secret);
  }

  async dispatchGrant(grant: AccessGrant): Promise<string> {
    return this.dispatchGrantOrRevoke('grant_access', grant);
  }

  async dispatchRevoke(grant: AccessGrant): Promise<string> {
    return this.dispatchGrantOrRevoke('revoke_access', grant);
  }

  private async dispatchGrantOrRevoke(
    method: 'grant_access' | 'revoke_access',
    grant: AccessGrant,
  ): Promise<string> {
    const sourceAccount = await this.server.getAccount(
      this.sourceKeypair.publicKey(),
    );

    const contract = new Contract(this.contractId);
    const operation = contract.call(
      method,
      nativeToScVal(grant.patientId, { type: 'string' }),
      nativeToScVal(grant.granteeId, { type: 'string' }),
      nativeToScVal(grant.recordIds.join(','), { type: 'string' }),
      nativeToScVal(grant.accessLevel, { type: 'string' }),
      nativeToScVal(Math.floor(grant.expiresAt.getTime() / 1000), {
        type: 'u64',
      }),
    );

    const tx = new TransactionBuilder(sourceAccount, {
      fee: '1000000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const prepared = await this.server.prepareTransaction(tx);
    prepared.sign(this.sourceKeypair);

    const sendResponse = await this.server.sendTransaction(prepared);
    if (sendResponse.status === 'ERROR') {
      throw new Error(
        `Soroban ${method} submission failed: ${JSON.stringify(
          sendResponse.errorResult ?? sendResponse.status,
        )}`,
      );
    }

    const txHash = sendResponse.hash;

    // Poll until the transaction is confirmed on-chain.
    let getResponse = await this.server.getTransaction(txHash);
    const deadline = Date.now() + 30_000;
    while (
      getResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      getResponse = await this.server.getTransaction(txHash);
    }

    if (getResponse.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(
        `Soroban ${method} transaction ${txHash} did not succeed: ${getResponse.status}`,
      );
    }

    this.logger.log(`Soroban ${method} confirmed on-chain: ${txHash}`);
    return txHash;
  }
}
