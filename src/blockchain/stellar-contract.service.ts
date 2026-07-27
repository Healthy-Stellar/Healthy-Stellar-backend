import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  AnchorRecordArgs,
  AnchorRecordResult,
  GrantAccessArgs,
  GrantAccessResult,
  RevokeAccessArgs,
  RevokeAccessResult,
  VerifyAccessArgs,
  VerifyAccessResult,
  CONTRACT_METHODS,
  encodeAnchorRecord,
  encodeGrantAccess,
  encodeRevokeAccess,
  encodeVerifyAccess,
  decodeVerifyAccessResult,
} from './generated';

/**
 * StellarContractService
 *
 * Type-safe wrapper around the Soroban contract bindings generated in
 * src/blockchain/generated/contract-types.ts.
 *
 * All public methods accept and return fully-typed interfaces — passing
 * wrong argument types will produce a TypeScript compile error.
 */
@Injectable()
export class StellarContractService {
  private readonly logger = new Logger(StellarContractService.name);

  private readonly sorobanServer: StellarSdk.SorobanRpc.Server;
  private readonly horizonServer: StellarSdk.Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly sourceKeypair: StellarSdk.Keypair;
  private readonly contract: StellarSdk.Contract;
  private readonly feeBudget: number;
  private readonly maxRetries: number;
  private readonly BASE_DELAY_MS = 500;

  constructor(private readonly configService: ConfigService) {
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
    if (!secretKey) {
      throw new Error('STELLAR_SECRET_KEY is required for StellarContractService');
    }
    this.sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);

    const contractId = this.configService.get<string>('STELLAR_CONTRACT_ID', '');
    this.contract = new StellarSdk.Contract(contractId);

    this.feeBudget = parseInt(
      this.configService.get<string>('STELLAR_FEE_BUDGET', '10000000'),
      10,
    );
    this.maxRetries = parseInt(this.configService.get<string>('STELLAR_MAX_RETRIES', '3'), 10);

    this.logger.log(
      `StellarContractService ready — network: ${network}, contractId: ${contractId || '(not set)'}`,
    );
  }

  // ── Public typed API ──────────────────────────────────────────────────────

  /** Anchor a medical record's IPFS CID on-chain. */
  async anchorRecord(args: AnchorRecordArgs): Promise<AnchorRecordResult> {
    this.logger.log(`[anchorRecord] patientId=${args.patientId} cid=${args.cid}`);
    return this.withRetry('anchorRecord', () =>
      this.invokeContract(CONTRACT_METHODS.ANCHOR_RECORD, encodeAnchorRecord(args)),
    );
  }

  /** Grant time-limited access to a medical record. */
  async grantAccess(args: GrantAccessArgs): Promise<GrantAccessResult> {
    this.logger.log(
      `[grantAccess] patientId=${args.patientId} granteeId=${args.granteeId} recordId=${args.recordId}`,
    );
    return this.withRetry('grantAccess', () =>
      this.invokeContract(CONTRACT_METHODS.GRANT_ACCESS, encodeGrantAccess(args)),
    );
  }

  /** Revoke a previously granted access right. */
  async revokeAccess(args: RevokeAccessArgs): Promise<RevokeAccessResult> {
    this.logger.log(
      `[revokeAccess] patientId=${args.patientId} granteeId=${args.granteeId} recordId=${args.recordId}`,
    );
    return this.withRetry('revokeAccess', () =>
      this.invokeContract(CONTRACT_METHODS.REVOKE_ACCESS, encodeRevokeAccess(args)),
    );
  }

  /**
   * Check whether a requester has valid access to a record.
   * Read-only simulation — does not submit a transaction.
   */
  async verifyAccess(args: VerifyAccessArgs): Promise<VerifyAccessResult> {
    this.logger.log(
      `[verifyAccess] requesterId=${args.requesterId} recordId=${args.recordId}`,
    );
    return this.withRetry('verifyAccess', () => this.simulateVerifyAccess(args));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async invokeContract(
    method: string,
    args: StellarSdk.xdr.ScVal[],
  ): Promise<AnchorRecordResult | GrantAccessResult | RevokeAccessResult> {
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
      throw new Error(
        `Transaction submission error for "${method}": ${JSON.stringify(sendResult.errorResult)}`,
      );
    }

    return this.pollForConfirmation(sendResult.hash);
  }

  private async simulateVerifyAccess(args: VerifyAccessArgs): Promise<VerifyAccessResult> {
    const account = await this.horizonServer.loadAccount(this.sourceKeypair.publicKey());

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: this.feeBudget.toString(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract.call(CONTRACT_METHODS.VERIFY_ACCESS, ...encodeVerifyAccess(args)))
      .setTimeout(30)
      .build();

    const simResult = await this.sorobanServer.simulateTransaction(tx);

    if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
      this.logger.warn(`[verifyAccess] simulation error — treating as no access: ${simResult.error}`);
      return { hasAccess: false, expiresAt: null };
    }

    const retval = (simResult as StellarSdk.SorobanRpc.Api.SimulateTransactionSuccessResponse)
      .result?.retval;

    if (!retval) return { hasAccess: false, expiresAt: null };

    return decodeVerifyAccessResult(retval);
  }

  private async pollForConfirmation(
    txHash: string,
    pollIntervalMs = 2000,
    maxPolls = 15,
  ): Promise<AnchorRecordResult> {
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
          this.logger.warn(
            `[${operationName}] attempt ${attempt}/${this.maxRetries} failed — retrying in ${delay}ms`,
          );
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
