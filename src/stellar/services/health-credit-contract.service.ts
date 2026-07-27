import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as StellarSdk from '@stellar/stellar-sdk';

export interface HealthCreditTxResult {
  txHash: string;
  ledger: number;
  confirmedAt: number;
}

export interface HealthCreditBalance {
  accountId: string;
  balance: string;
  contractId: string;
  fetchedAt: Date;
}

export enum HealthCreditEventType {
  ISSUED = 'health_credit.issued',
  REDEEMED = 'health_credit.redeemed',
  TRANSFERRED = 'health_credit.transferred',
  BURNED = 'health_credit.burned',
}

/**
 * ContractService for Soroban-based tokenised health credits.
 * Supports mint, transfer, burn, and balance queries against the
 * health credit token contract deployed on Soroban testnet.
 */
@Injectable()
export class HealthCreditContractService {
  private readonly logger = new Logger(HealthCreditContractService.name);

  private readonly sorobanServer: StellarSdk.SorobanRpc.Server;
  private readonly horizonServer: StellarSdk.Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly sourceKeypair: StellarSdk.Keypair;
  private readonly contract: StellarSdk.Contract;
  private readonly feeBudget: number;
  private readonly maxRetries: number;
  private readonly BASE_DELAY_MS = 500;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    const isMainnet = network === 'mainnet';

    const sorobanRpcUrl = isMainnet
      ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
      : 'https://soroban-testnet.stellar.org';

    const horizonUrl = isMainnet
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';

    this.networkPassphrase = isMainnet ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;

    this.sorobanServer = new StellarSdk.SorobanRpc.Server(sorobanRpcUrl, { allowHttp: false });
    this.horizonServer = new StellarSdk.Horizon.Server(horizonUrl, { allowHttp: false });

    const secretKey = this.configService.get<string>('STELLAR_SECRET_KEY');
    if (!secretKey) throw new Error('STELLAR_SECRET_KEY is required for HealthCreditContractService');
    this.sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);

    const contractId = this.configService.get<string>('HEALTH_CREDIT_CONTRACT_ID', '');
    this.contract = new StellarSdk.Contract(contractId);

    this.feeBudget = parseInt(this.configService.get<string>('STELLAR_FEE_BUDGET', '10000000'), 10);
    this.maxRetries = parseInt(this.configService.get<string>('STELLAR_MAX_RETRIES', '3'), 10);

    this.logger.log(
      `HealthCreditContractService ready — network: ${network}, contractId: ${contractId || '(not set)'}`,
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Mint health credits to a recipient account. */
  async mint(toAccountId: string, amount: bigint): Promise<HealthCreditTxResult> {
    this.logger.log(`[mint] to=${toAccountId} amount=${amount}`);
    const result = await this.withRetry('mint', () =>
      this.invokeContract('mint', [
        StellarSdk.nativeToScVal(toAccountId, { type: 'address' }),
        StellarSdk.nativeToScVal(amount, { type: 'i128' }),
      ]),
    );
    this.eventEmitter.emit(HealthCreditEventType.ISSUED, { toAccountId, amount: amount.toString(), txHash: result.txHash });
    return result;
  }

  /** Transfer health credits between accounts. */
  async transfer(fromAccountId: string, toAccountId: string, amount: bigint): Promise<HealthCreditTxResult> {
    this.logger.log(`[transfer] from=${fromAccountId} to=${toAccountId} amount=${amount}`);
    const result = await this.withRetry('transfer', () =>
      this.invokeContract('transfer', [
        StellarSdk.nativeToScVal(fromAccountId, { type: 'address' }),
        StellarSdk.nativeToScVal(toAccountId, { type: 'address' }),
        StellarSdk.nativeToScVal(amount, { type: 'i128' }),
      ]),
    );
    this.eventEmitter.emit(HealthCreditEventType.TRANSFERRED, {
      fromAccountId, toAccountId, amount: amount.toString(), txHash: result.txHash,
    });
    return result;
  }

  /** Burn health credits from an account (redeem / expire). */
  async burn(fromAccountId: string, amount: bigint): Promise<HealthCreditTxResult> {
    this.logger.log(`[burn] from=${fromAccountId} amount=${amount}`);
    const result = await this.withRetry('burn', () =>
      this.invokeContract('burn', [
        StellarSdk.nativeToScVal(fromAccountId, { type: 'address' }),
        StellarSdk.nativeToScVal(amount, { type: 'i128' }),
      ]),
    );
    this.eventEmitter.emit(HealthCreditEventType.BURNED, { fromAccountId, amount: amount.toString(), txHash: result.txHash });
    return result;
  }

  /** Query the health credit token balance for an account (read-only simulation). */
  async getBalance(accountId: string): Promise<HealthCreditBalance> {
    this.logger.log(`[balance] accountId=${accountId}`);
    const account = await this.horizonServer.loadAccount(this.sourceKeypair.publicKey());

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: this.feeBudget.toString(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          'balance',
          StellarSdk.nativeToScVal(accountId, { type: 'address' }),
        ),
      )
      .setTimeout(30)
      .build();

    const simResult = await this.sorobanServer.simulateTransaction(tx);

    if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Balance simulation failed for ${accountId}: ${simResult.error}`);
    }

    const retval = (simResult as StellarSdk.SorobanRpc.Api.SimulateTransactionSuccessResponse)
      .result?.retval;

    const balance = retval ? StellarSdk.scValToNative(retval).toString() : '0';

    return {
      accountId,
      balance,
      contractId: this.contract.contractId(),
      fetchedAt: new Date(),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async invokeContract(method: string, args: StellarSdk.xdr.ScVal[]): Promise<HealthCreditTxResult> {
    const account = await this.horizonServer.loadAccount(this.sourceKeypair.publicKey());

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: this.feeBudget.toString(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const simResult = await this.sorobanServer.simulateTransaction(tx);
    if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Soroban simulation failed for "${method}": ${simResult.error}`);
    }

    const preparedTx = StellarSdk.SorobanRpc.assembleTransaction(tx, simResult).build();
    preparedTx.sign(this.sourceKeypair);

    const sendResult = await this.sorobanServer.sendTransaction(preparedTx);
    if (sendResult.status === 'ERROR') {
      throw new Error(`Transaction submission error for "${method}": ${JSON.stringify(sendResult.errorResult)}`);
    }

    return this.pollForConfirmation(sendResult.hash);
  }

  private async pollForConfirmation(
    txHash: string,
    pollIntervalMs = 2000,
    maxPolls = 15,
  ): Promise<HealthCreditTxResult> {
    for (let i = 0; i < maxPolls; i++) {
      await this.sleep(pollIntervalMs);
      const status = await this.sorobanServer.getTransaction(txHash);

      if (status.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`[poll] txHash=${txHash} confirmed`);
        return { txHash, ledger: status.ledger ?? 0, confirmedAt: Date.now() };
      }

      if (status.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction ${txHash} failed on-chain`);
      }
    }

    throw new Error(`Transaction ${txHash} did not confirm within ${maxPolls * pollIntervalMs}ms`);
  }

  private async withRetry<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          const delay = this.BASE_DELAY_MS * Math.pow(2, attempt - 1);
          this.logger.warn(`[${operationName}] attempt ${attempt}/${this.maxRetries} failed — retrying in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }
    this.logger.error(`[${operationName}] all retries exhausted: ${lastError?.message}`);
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
