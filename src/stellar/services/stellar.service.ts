import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  StellarTxResult,
  StellarVerifyResult,
  StellarOperationLog,
} from '../interfaces/stellar-contract.interface';

/**
 * StellarService
 *
 * Provides a clean, injectable interface for all Soroban smart-contract
 * operations used across the application.  Every method includes:
 *
 *  • Exponential-backoff retry (max 3 attempts, configurable)
 *  • A configurable transaction fee budget (STELLAR_FEE_BUDGET env var)
 *  • Structured NestJS Logger output for every operation
 *  • Testnet / Mainnet selection via STELLAR_NETWORK env var
 */
@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);

  // ── Configuration ────────────────────────────────────────────────────────
  private readonly server: StellarSdk.SorobanRpc.Server;
  private readonly horizonServer: StellarSdk.Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly sourceKeypair: StellarSdk.Keypair;
  private readonly contractId: string;
  private readonly feeBudget: number;
  private readonly maxRetries: number;

  // Base delay (ms) for exponential back-off
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

    this.server = new StellarSdk.SorobanRpc.Server(sorobanRpcUrl, {
      allowHttp: false,
    });

    this.horizonServer = new StellarSdk.Horizon.Server(horizonUrl, {
      allowHttp: false,
    });

    const secretKey = this.configService.get<string>('STELLAR_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STELLAR_SECRET_KEY environment variable is required for StellarService');
    }
    this.sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);

    this.contractId = this.configService.get<string>('STELLAR_CONTRACT_ID', '');
    this.feeBudget = parseInt(this.configService.get<string>('STELLAR_FEE_BUDGET', '10000000'), 10);
    this.maxRetries = parseInt(this.configService.get<string>('STELLAR_MAX_RETRIES', '3'), 10);

    this.logger.log(
      `StellarService initialised — network: ${network}, contractId: ${this.contractId || '(not set)'}`,
    );
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Anchor (write) a medical record's IPFS CID on-chain tied to a patient.
   *
   * @param patientId  Unique patient identifier.
   * @param cid        IPFS Content Identifier (CIDv0 / CIDv1).
   * @returns          Transaction hash.
   */
  async anchorRecord(patientId: string, cid: string): Promise<StellarTxResult> {
    this.logger.log(`[anchorRecord] patientId=${patientId} cid=${cid}`);
    return this.withRetry('anchorRecord', () =>
      this.invokeContract('anchor_record', [
        StellarSdk.nativeToScVal(patientId, { type: 'string' }),
        StellarSdk.nativeToScVal(cid, { type: 'string' }),
      ]),
    );
  }

  /**
   * Grant time-limited access to a medical record for another party.
   *
   * @param patientId   Owner patient's identifier.
   * @param granteeId   Identifier of the party being granted access.
   * @param recordId    Specific record identifier.
   * @param expiresAt   UTC date at which the grant expires.
   * @returns           Transaction hash.
   */
  async grantAccess(
    patientId: string,
    granteeId: string,
    recordId: string,
    expiresAt: Date,
  ): Promise<StellarTxResult> {
    const expiresAtMs = expiresAt.getTime();
    this.logger.log(
      `[grantAccess] patientId=${patientId} granteeId=${granteeId} recordId=${recordId} expiresAt=${expiresAt.toISOString()}`,
    );
    return this.withRetry('grantAccess', () =>
      this.invokeContract('grant_access', [
        StellarSdk.nativeToScVal(patientId, { type: 'string' }),
        StellarSdk.nativeToScVal(granteeId, { type: 'string' }),
        StellarSdk.nativeToScVal(recordId, { type: 'string' }),
        StellarSdk.nativeToScVal(expiresAtMs, { type: 'u64' }),
      ]),
    );
  }

  /**
   * Revoke a previously granted access right.
   *
   * @param patientId  Owner patient's identifier.
   * @param granteeId  Identifier of the party whose access is revoked.
   * @param recordId   Specific record identifier.
   * @returns          Transaction hash.
   */
  async revokeAccess(
    patientId: string,
    granteeId: string,
    recordId: string,
  ): Promise<StellarTxResult> {
    this.logger.log(
      `[revokeAccess] patientId=${patientId} granteeId=${granteeId} recordId=${recordId}`,
    );
    return this.withRetry('revokeAccess', () =>
      this.invokeContract('revoke_access', [
        StellarSdk.nativeToScVal(patientId, { type: 'string' }),
        StellarSdk.nativeToScVal(granteeId, { type: 'string' }),
        StellarSdk.nativeToScVal(recordId, { type: 'string' }),
      ]),
    );
  }

  /**
   * Check whether a requester currently has valid access to a record.
   * This is a read-only simulation — it does not submit a transaction.
   *
   * @param requesterId  Identifier of the access requester.
   * @param recordId     Specific record identifier.
   * @returns            `{ hasAccess, expiresAt }`.
   */
  async verifyAccess(requesterId: string, recordId: string): Promise<StellarVerifyResult> {
    this.logger.log(`[verifyAccess] requesterId=${requesterId} recordId=${recordId}`);
    return this.withRetry('verifyAccess', () => this.simulateVerifyAccess(requesterId, recordId));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Build, simulate, sign, submit, and await a Soroban contract invocation.
   */
  private async invokeContract(
    method: string,
    args: StellarSdk.xdr.ScVal[],
  ): Promise<StellarTxResult> {
    const account = await this.horizonServer.loadAccount(this.sourceKeypair.publicKey());

    const contract = new StellarSdk.Contract(this.contractId);
    const operation = contract.call(method, ...args);

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: this.feeBudget.toString(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    // Simulate first to get resource footprint
    const simResult = await this.server.simulateTransaction(tx);
    if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Soroban simulation failed for "${method}": ${simResult.error}`);
    }

    // Assemble the transaction with simulation data
    const preparedTx = StellarSdk.SorobanRpc.assembleTransaction(tx, simResult).build();

    // Sign
    preparedTx.sign(this.sourceKeypair);

    // Submit
    const sendResult = await this.server.sendTransaction(preparedTx);
    if (sendResult.status === 'ERROR') {
      throw new Error(
        `Transaction submission error for "${method}": ${JSON.stringify(sendResult.errorResult)}`,
      );
    }

    // Poll for completion
    const confirmation = await this.pollForConfirmation(sendResult.hash);
    return confirmation;
  }

  /**
   * Simulate verifyAccess without submitting a transaction.
   */
  private async simulateVerifyAccess(
    requesterId: string,
    recordId: string,
  ): Promise<StellarVerifyResult> {
    const account = await this.horizonServer.loadAccount(this.sourceKeypair.publicKey());

    const contract = new StellarSdk.Contract(this.contractId);
    const operation = contract.call(
      'verify_access',
      StellarSdk.nativeToScVal(requesterId, { type: 'string' }),
      StellarSdk.nativeToScVal(recordId, { type: 'string' }),
    );

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: this.feeBudget.toString(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);

    if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
      this.logger.warn(
        `[verifyAccess] simulation returned error — treating as no access: ${simResult.error}`,
      );
      return { hasAccess: false, expiresAt: null };
    }

    // Parse the simulated return value
    const returnVal = (simResult as StellarSdk.SorobanRpc.Api.SimulateTransactionSuccessResponse)
      .result?.retval;

    if (!returnVal) {
      return { hasAccess: false, expiresAt: null };
    }

    // Contract is expected to return a struct: { has_access: bool, expires_at: u64 }
    // Decode using scValToNative
    const native = StellarSdk.scValToNative(returnVal) as {
      has_access?: boolean;
      expires_at?: bigint | number;
    };

    const hasAccess = Boolean(native?.has_access);
    const expiresAtRaw = native?.expires_at;
    const expiresAt = expiresAtRaw != null ? new Date(Number(expiresAtRaw)).toISOString() : null;

    this.logger.log(
      `[verifyAccess] requesterId=${requesterId} recordId=${recordId} hasAccess=${hasAccess}`,
    );

    return { hasAccess, expiresAt };
  }

  /**
   * Poll the Soroban RPC until a submitted transaction is COMPLETE or FAILED.
   */
  private async pollForConfirmation(
    txHash: string,
    pollIntervalMs = 2000,
    maxPolls = 15,
  ): Promise<StellarTxResult> {
    for (let i = 0; i < maxPolls; i++) {
      await this.sleep(pollIntervalMs);

      const statusResponse = await this.server.getTransaction(txHash);

      if (statusResponse.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        this.logger.log(`[poll] txHash=${txHash} confirmed`);
        return {
          txHash,
          ledger: statusResponse.ledger ?? 0,
          confirmedAt: Date.now(),
        };
      }

      if (statusResponse.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction ${txHash} failed on-chain: ${JSON.stringify(statusResponse)}`);
      }

      this.logger.debug(
        `[poll] txHash=${txHash} status=${statusResponse.status} attempt=${i + 1}/${maxPolls}`,
      );
    }

    throw new Error(`Transaction ${txHash} did not confirm within ${maxPolls * pollIntervalMs}ms`);
  }

  /**
   * Wrap any async operation with exponential-backoff retry logic.
   * Max retries are read from STELLAR_MAX_RETRIES (default 3).
   */
  private async withRetry<T>(
    operationName: StellarOperationLog['operation'],
    fn: () => Promise<T>,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const startMs = Date.now();
      try {
        const result = await fn();
        const durationMs = Date.now() - startMs;

        this.logOperation({
          operation: operationName,
          attempt,
          durationMs,
          success: true,
          txHash: (result as any)?.txHash,
        });

        return result;
      } catch (err: any) {
        const durationMs = Date.now() - startMs;
        lastError = err instanceof Error ? err : new Error(String(err));

        this.logOperation({
          operation: operationName,
          attempt,
          durationMs,
          success: false,
          error: lastError.message,
        });

        if (attempt < this.maxRetries) {
          const delay = this.BASE_DELAY_MS * Math.pow(2, attempt - 1);
          this.logger.warn(
            `[${operationName}] attempt ${attempt}/${this.maxRetries} failed — retrying in ${delay}ms. Error: ${lastError.message}`,
          );
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(
      `[${operationName}] all ${this.maxRetries} retries exhausted. Last error: ${lastError?.message}`,
      lastError?.stack,
    );
    throw lastError;
  }

  /**
   * Emit a structured log entry for every operation attempt.
   */
  private logOperation(entry: StellarOperationLog): void {
    const level = entry.success ? 'log' : 'warn';
    const payload = JSON.stringify(entry);
    this.logger[level](`[StellarOperation] ${payload}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
