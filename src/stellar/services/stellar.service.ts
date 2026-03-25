import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';
import {
  StellarTxResult,
  StellarVerifyResult,
  StellarOperationLog,
  SubmitTransactionResult,
  StellarAccountInfo,
  InvokeContractResult,
  ContractEvent,
  StellarNetwork,
} from '../interfaces/stellar-contract.interface';

/**
 * StellarService
 *
 * Injectable NestJS provider that abstracts all Stellar/Soroban SDK interactions.
 * Supports runtime switching between Testnet and Mainnet via STELLAR_NETWORK env var.
 *
 * Required methods (Issue #234):
 *  • submitTransaction  — sign & submit a pre-built XDR transaction
 *  • getAccount         — fetch typed account info from Horizon
 *  • invokeContract     — call a Soroban contract method, returns decoded result
 *  • getContractEvents  — fetch and decode contract events from Soroban RPC
 *
 * All methods return typed responses — no raw SDK objects are leaked.
 * Every method includes exponential-backoff retry and structured logging.
 */
@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);

  // ── Configuration ────────────────────────────────────────────────────────
  private readonly server: StellarSdk.SorobanRpc.Server;
  private readonly horizonServer: StellarSdk.Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly network: StellarNetwork;
  private readonly sourceKeypair: StellarSdk.Keypair;
  private readonly contractId: string;
  private readonly feeBudget: number;
  private readonly maxRetries: number;

  // Base delay (ms) for exponential back-off
  private readonly BASE_DELAY_MS = 500;

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly tracingService?: any, // TracingService - optional to avoid circular deps
  ) {
    const rawNetwork = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.network = rawNetwork === 'mainnet' ? 'mainnet' : 'testnet';
    const isMainnet = this.network === 'mainnet';

    const sorobanRpcUrl = isMainnet
      ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
      : 'https://soroban-testnet.stellar.org';

    const horizonUrl = isMainnet
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';

    this.networkPassphrase = isMainnet ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;

    this.server = new StellarSdk.SorobanRpc.Server(sorobanRpcUrl, { allowHttp: false });
    this.horizonServer = new StellarSdk.Horizon.Server(horizonUrl, { allowHttp: false });

    const secretKey = this.configService.get<string>('STELLAR_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STELLAR_SECRET_KEY environment variable is required for StellarService');
    }
    this.sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);

    this.contractId = this.configService.get<string>('STELLAR_CONTRACT_ID', '');
    this.feeBudget = parseInt(this.configService.get<string>('STELLAR_FEE_BUDGET', '10000000'), 10);
    this.maxRetries = parseInt(this.configService.get<string>('STELLAR_MAX_RETRIES', '3'), 10);

    this.logger.log(
      `StellarService initialised — network: ${this.network}, contractId: ${this.contractId || '(not set)'}`,
    );
  }

  /** Expose the active network for consumers that need to know. */
  getNetwork(): StellarNetwork {
    return this.network;
  }

  // ── Issue #234 — Required public API ─────────────────────────────────────

  /**
   * Submit a pre-built, XDR-encoded transaction to the network.
   * Signs with the configured source keypair, submits, and polls for confirmation.
   *
   * @param xdr  Base64-encoded XDR transaction envelope.
   * @returns    Typed SubmitTransactionResult — no raw SDK objects.
   */
  async submitTransaction(xdr: string): Promise<SubmitTransactionResult> {
    this.logger.log('[submitTransaction] submitting XDR transaction');
    return this.withRetry('submitTransaction', async () => {
      const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, this.networkPassphrase);
      tx.sign(this.sourceKeypair);

      const sendResult = await this.server.sendTransaction(tx);
      if (sendResult.status === 'ERROR') {
        throw new Error(
          `submitTransaction error: ${JSON.stringify(sendResult.errorResult)}`,
        );
      }

      const confirmed = await this.pollForConfirmation(sendResult.hash);
      return { ...confirmed, status: 'SUCCESS' as const };
    });
  }

  /**
   * Fetch typed account information from Horizon.
   * Returns only plain data — no raw AccountResponse object.
   *
   * @param accountId  Stellar public key (G…).
   * @returns          Typed StellarAccountInfo.
   */
  async getAccount(accountId: string): Promise<StellarAccountInfo> {
    this.logger.log(`[getAccount] accountId=${accountId}`);
    return this.withRetry('getAccount', async () => {
      const raw = await this.horizonServer.loadAccount(accountId);
      return {
        accountId: raw.accountId(),
        sequence: raw.sequenceNumber(),
        balances: raw.balances.map((b: any) => ({
          asset:
            b.asset_type === 'native'
              ? 'XLM'
              : `${b.asset_code}:${b.asset_issuer}`,
          balance: b.balance,
        })),
      };
    });
  }

  /**
   * Invoke a Soroban smart-contract method and return a decoded typed result.
   * Simulates first, assembles, signs, submits, and decodes the return value.
   *
   * @param contractId  Contract address (C…).
   * @param method      Contract function name.
   * @param args        ScVal arguments.
   * @returns           Typed InvokeContractResult with decoded returnValue.
   */
  async invokeContract(
    contractId: string,
    method: string,
    args: StellarSdk.xdr.ScVal[],
  ): Promise<InvokeContractResult> {
    this.logger.log(`[invokeContract] contractId=${contractId} method=${method}`);
    return this.withRetry('invokeContract', async () => {
      const account = await this.horizonServer.loadAccount(this.sourceKeypair.publicKey());
      const contract = new StellarSdk.Contract(contractId);
      const operation = contract.call(method, ...args);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: this.feeBudget.toString(),
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      const simResult = await this.server.simulateTransaction(tx);
      if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
        throw new Error(`Soroban simulation failed for "${method}": ${simResult.error}`);
      }

      const preparedTx = StellarSdk.SorobanRpc.assembleTransaction(tx, simResult).build();
      preparedTx.sign(this.sourceKeypair);

      const sendResult = await this.server.sendTransaction(preparedTx);
      if (sendResult.status === 'ERROR') {
        throw new Error(
          `invokeContract submission error for "${method}": ${JSON.stringify(sendResult.errorResult)}`,
        );
      }

      const confirmed = await this.pollForConfirmation(sendResult.hash);

      // Decode the return value — never leak raw ScVal
      const successSim =
        simResult as StellarSdk.SorobanRpc.Api.SimulateTransactionSuccessResponse;
      const returnValue = successSim.result?.retval
        ? StellarSdk.scValToNative(successSim.result.retval)
        : null;

      return { ...confirmed, returnValue };
    });
  }

  /**
   * Fetch and decode contract events from the Soroban RPC.
   *
   * @param startLedger  Ledger sequence to start scanning from.
   * @param contractId   Optional contract address filter (defaults to configured contractId).
   * @returns            Array of typed ContractEvent — no raw SDK objects.
   */
  async getContractEvents(
    startLedger: number,
    contractId?: string,
  ): Promise<ContractEvent[]> {
    const targetContract = contractId ?? this.contractId;
    this.logger.log(
      `[getContractEvents] contractId=${targetContract} startLedger=${startLedger}`,
    );
    return this.withRetry('getContractEvents', async () => {
      const response = await this.server.getEvents({
        startLedger,
        filters: [{ type: 'contract', contractIds: [targetContract] }],
      });

      return response.events.map((e: any) => ({
        id: e.id,
        ledger: e.ledger,
        contractId: e.contractId,
        topics: (e.topic ?? []).map((t: StellarSdk.xdr.ScVal) =>
          StellarSdk.scValToNative(t),
        ),
        value: e.value ? StellarSdk.scValToNative(e.value) : null,
      }));
    });
  }

  // ── Existing domain methods ───────────────────────────────────────────────

  /**
   * Anchor (write) a medical record's IPFS CID on-chain tied to a patient.
   *
   * @param patientId  Unique patient identifier.
   * @param cid        IPFS Content Identifier (CIDv0 / CIDv1).
   * @returns          Transaction hash.
   */
  async anchorRecord(patientId: string, cid: string): Promise<StellarTxResult> {
    this.logger.log(`[anchorRecord] patientId=${patientId} cid=${cid}`);

    if (this.tracingService) {
      return this.tracingService.withSpan(
        'stellar.anchorRecord',
        async (span) => {
          span.setAttribute('stellar.patient_id', patientId);
          span.setAttribute('stellar.cid', cid);
          span.setAttribute('stellar.network', this.network);
          span.setAttribute('stellar.contract_id', this.contractId);

          this.tracingService.addEvent('stellar.anchorRecord.started', {
            patientId,
            cid,
          });

          try {
            const result = await this.withRetry('anchorRecord', () =>
              this.invokeContractInternal('anchor_record', [
                StellarSdk.nativeToScVal(patientId, { type: 'string' }),
                StellarSdk.nativeToScVal(cid, { type: 'string' }),
              ]),
            );

            span.setAttribute('stellar.tx_hash', result.txHash);
            span.setAttribute('stellar.ledger', result.ledger);

            this.tracingService.addEvent('stellar.anchorRecord.completed', {
              txHash: result.txHash,
              ledger: result.ledger,
            });

            return result;
          } catch (error) {
            this.tracingService.addEvent('stellar.anchorRecord.error', {
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        },
      );
    }

    return this.withRetry('anchorRecord', () =>
      this.invokeContractInternal('anchor_record', [
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

    if (this.tracingService) {
      return this.tracingService.withSpan(
        'stellar.grantAccess',
        async (span) => {
          span.setAttribute('stellar.patient_id', patientId);
          span.setAttribute('stellar.grantee_id', granteeId);
          span.setAttribute('stellar.record_id', recordId);
          span.setAttribute('stellar.expires_at', expiresAt.toISOString());
          span.setAttribute('stellar.network', this.network);

          this.tracingService.addEvent('stellar.grantAccess.started', {
            patientId,
            granteeId,
            recordId,
          });

          try {
            const result = await this.withRetry('grantAccess', () =>
              this.invokeContractInternal('grant_access', [
                StellarSdk.nativeToScVal(patientId, { type: 'string' }),
                StellarSdk.nativeToScVal(granteeId, { type: 'string' }),
                StellarSdk.nativeToScVal(recordId, { type: 'string' }),
                StellarSdk.nativeToScVal(expiresAtMs, { type: 'u64' }),
              ]),
            );

            span.setAttribute('stellar.tx_hash', result.txHash);
            this.tracingService.addEvent('stellar.grantAccess.completed', {
              txHash: result.txHash,
            });

            return result;
          } catch (error) {
            this.tracingService.addEvent('stellar.grantAccess.error', {
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        },
      );
    }

    return this.withRetry('grantAccess', () =>
      this.invokeContractInternal('grant_access', [
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

    if (this.tracingService) {
      return this.tracingService.withSpan(
        'stellar.revokeAccess',
        async (span) => {
          span.setAttribute('stellar.patient_id', patientId);
          span.setAttribute('stellar.grantee_id', granteeId);
          span.setAttribute('stellar.record_id', recordId);
          span.setAttribute('stellar.network', this.network);

          this.tracingService.addEvent('stellar.revokeAccess.started', {
            patientId,
            granteeId,
            recordId,
          });

          try {
            const result = await this.withRetry('revokeAccess', () =>
              this.invokeContractInternal('revoke_access', [
                StellarSdk.nativeToScVal(patientId, { type: 'string' }),
                StellarSdk.nativeToScVal(granteeId, { type: 'string' }),
                StellarSdk.nativeToScVal(recordId, { type: 'string' }),
              ]),
            );

            span.setAttribute('stellar.tx_hash', result.txHash);
            this.tracingService.addEvent('stellar.revokeAccess.completed', {
              txHash: result.txHash,
            });

            return result;
          } catch (error) {
            this.tracingService.addEvent('stellar.revokeAccess.error', {
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        },
      );
    }

    return this.withRetry('revokeAccess', () =>
      this.invokeContractInternal('revoke_access', [
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

    if (this.tracingService) {
      return this.tracingService.withSpan(
        'stellar.verifyAccess',
        async (span) => {
          span.setAttribute('stellar.requester_id', requesterId);
          span.setAttribute('stellar.record_id', recordId);
          span.setAttribute('stellar.network', this.network);

          this.tracingService.addEvent('stellar.verifyAccess.started', {
            requesterId,
            recordId,
          });

          try {
            const result = await this.withRetry('verifyAccess', () => this.simulateVerifyAccess(requesterId, recordId));

            span.setAttribute('stellar.has_access', result.hasAccess);
            if (result.expiresAt) {
              span.setAttribute('stellar.expires_at', result.expiresAt);
            }

            this.tracingService.addEvent('stellar.verifyAccess.completed', {
              hasAccess: result.hasAccess,
              expiresAt: result.expiresAt,
            });

            return result;
          } catch (error) {
            this.tracingService.addEvent('stellar.verifyAccess.error', {
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        },
      );
    }

    return this.withRetry('verifyAccess', () => this.simulateVerifyAccess(requesterId, recordId));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Build, simulate, sign, submit, and await a Soroban contract invocation.
   * Used internally by the legacy domain methods (anchorRecord, grantAccess, revokeAccess).
   */
  private async invokeContractInternal(
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

    const simResult = await this.server.simulateTransaction(tx);
    if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Soroban simulation failed for "${method}": ${simResult.error}`);
    }

    const preparedTx = StellarSdk.SorobanRpc.assembleTransaction(tx, simResult).build();
    preparedTx.sign(this.sourceKeypair);

    const sendResult = await this.server.sendTransaction(preparedTx);
    if (sendResult.status === 'ERROR') {
      throw new Error(
        `Transaction submission error for "${method}": ${JSON.stringify(sendResult.errorResult)}`,
      );
    }

    return this.pollForConfirmation(sendResult.hash);
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
        const result = await this.circuitBreaker.execute('stellar', fn);
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
