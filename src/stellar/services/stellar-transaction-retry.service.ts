import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * Stellar Transaction Retry and Failure Recovery Service
 *
 * Handles robust transaction submission with:
 * - Exponential backoff retry logic
 * - Sequence number conflict resolution
 * - Network timeout handling
 * - Transaction status tracking
 * - Automatic transaction rebuilding on sequence errors
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
  sequenceRefreshEnabled: boolean;
}

export interface TransactionSubmissionResult {
  success: boolean;
  txHash?: string;
  ledger?: number;
  confirmedAt?: number;
  attempts: number;
  totalDurationMs: number;
  error?: string;
  errorType?: TransactionErrorType;
}

export enum TransactionErrorType {
  SEQUENCE_MISMATCH = 'SEQUENCE_MISMATCH',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INSUFFICIENT_FEE = 'INSUFFICIENT_FEE',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  UNKNOWN = 'UNKNOWN',
}

export interface TransactionContext {
  operation: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class StellarTransactionRetryService {
  private readonly logger = new Logger(StellarTransactionRetryService.name);
  private readonly config: RetryConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      maxRetries: parseInt(this.configService.get<string>('STELLAR_RETRY_MAX_ATTEMPTS', '5'), 10),
      baseDelayMs: parseInt(
        this.configService.get<string>('STELLAR_RETRY_BASE_DELAY_MS', '1000'),
        10,
      ),
      maxDelayMs: parseInt(
        this.configService.get<string>('STELLAR_RETRY_MAX_DELAY_MS', '30000'),
        10,
      ),
      timeoutMs: parseInt(
        this.configService.get<string>('STELLAR_TRANSACTION_TIMEOUT_MS', '60000'),
        10,
      ),
      sequenceRefreshEnabled:
        this.configService.get<string>('STELLAR_SEQUENCE_REFRESH_ENABLED', 'true') === 'true',
    };

    this.logger.log(
      `StellarTransactionRetryService initialized with config: ${JSON.stringify(this.config)}`,
    );
  }

  /**
   * Submit a transaction with automatic retry and failure recovery
   */
  async submitWithRetry(
    server: StellarSdk.SorobanRpc.Server,
    horizonServer: StellarSdk.Horizon.Server,
    transaction: StellarSdk.Transaction,
    sourceKeypair: StellarSdk.Keypair,
    context: TransactionContext,
  ): Promise<TransactionSubmissionResult> {
    const startTime = Date.now();
    let currentTx = transaction;
    let lastError: Error | undefined;
    let errorType: TransactionErrorType = TransactionErrorType.UNKNOWN;

    this.logger.log(`[${context.operation}] Starting transaction submission with retry logic`);

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const attemptStart = Date.now();

      try {
        // Sign the transaction
        currentTx.sign(sourceKeypair);

        // Submit transaction
        const sendResult = await this.submitTransaction(server, currentTx);

        if (sendResult.status === 'ERROR') {
          errorType = this.classifyError(sendResult.errorResult);
          throw new Error(
            `Transaction submission error: ${JSON.stringify(sendResult.errorResult)}`,
          );
        }

        // Poll for confirmation
        const confirmed = await this.pollForConfirmation(
          server,
          sendResult.hash,
          context.operation,
        );

        const totalDuration = Date.now() - startTime;

        this.logger.log(
          `[${context.operation}] Transaction confirmed: ${sendResult.hash} (attempts: ${attempt}, duration: ${totalDuration}ms)`,
        );

        return {
          success: true,
          txHash: sendResult.hash,
          ledger: confirmed.ledger,
          confirmedAt: confirmed.confirmedAt,
          attempts: attempt,
          totalDurationMs: totalDuration,
        };
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        errorType = this.classifyError(err);

        const attemptDuration = Date.now() - attemptStart;

        this.logger.warn(
          `[${context.operation}] Attempt ${attempt}/${this.config.maxRetries} failed (${attemptDuration}ms): ${lastError.message}`,
        );

        // Handle sequence number conflicts
        if (
          errorType === TransactionErrorType.SEQUENCE_MISMATCH &&
          this.config.sequenceRefreshEnabled &&
          attempt < this.config.maxRetries
        ) {
          this.logger.log(
            `[${context.operation}] Sequence mismatch detected, refreshing account and rebuilding transaction`,
          );

          try {
            currentTx = await this.rebuildTransactionWithFreshSequence(
              horizonServer,
              currentTx,
              sourceKeypair,
            );
          } catch (rebuildErr: any) {
            this.logger.error(
              `[${context.operation}] Failed to rebuild transaction: ${rebuildErr.message}`,
            );
            // Continue with original transaction
          }
        }

        // Check if we should retry
        if (attempt < this.config.maxRetries && this.shouldRetry(errorType)) {
          const delay = this.calculateBackoffDelay(attempt);
          this.logger.log(
            `[${context.operation}] Retrying in ${delay}ms (error type: ${errorType})`,
          );
          await this.sleep(delay);
        } else if (!this.shouldRetry(errorType)) {
          this.logger.error(`[${context.operation}] Non-retryable error encountered: ${errorType}`);
          break;
        }
      }
    }

    const totalDuration = Date.now() - startTime;

    this.logger.error(
      `[${context.operation}] Transaction failed after ${this.config.maxRetries} attempts (${totalDuration}ms): ${lastError?.message}`,
    );

    return {
      success: false,
      attempts: this.config.maxRetries,
      totalDurationMs: totalDuration,
      error: lastError?.message || 'Unknown error',
      errorType,
    };
  }

  /**
   * Submit transaction with timeout protection
   */
  private async submitTransaction(
    server: StellarSdk.SorobanRpc.Server,
    transaction: StellarSdk.Transaction,
  ): Promise<StellarSdk.SorobanRpc.Api.SendTransactionResponse> {
    return this.withTimeout(
      server.sendTransaction(transaction),
      this.config.timeoutMs,
      'Transaction submission timeout',
    );
  }

  /**
   * Poll for transaction confirmation with exponential backoff
   */
  private async pollForConfirmation(
    server: StellarSdk.SorobanRpc.Server,
    txHash: string,
    operation: string,
    pollIntervalMs = 2000,
    maxPolls = 30,
  ): Promise<{ ledger: number; confirmedAt: number }> {
    for (let i = 0; i < maxPolls; i++) {
      await this.sleep(pollIntervalMs);

      try {
        const statusResponse = await this.withTimeout(
          server.getTransaction(txHash),
          this.config.timeoutMs,
          'Transaction status check timeout',
        );

        if (statusResponse.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
          this.logger.log(
            `[${operation}] Transaction ${txHash} confirmed at ledger ${statusResponse.ledger}`,
          );
          return {
            ledger: statusResponse.ledger ?? 0,
            confirmedAt: Date.now(),
          };
        }

        if (statusResponse.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.FAILED) {
          throw new Error(
            `Transaction ${txHash} failed on-chain: ${JSON.stringify(statusResponse)}`,
          );
        }

        this.logger.debug(
          `[${operation}] Polling transaction ${txHash}: status=${statusResponse.status}, attempt=${i + 1}/${maxPolls}`,
        );
      } catch (err: any) {
        if (i === maxPolls - 1) {
          throw err;
        }
        this.logger.warn(`[${operation}] Poll attempt ${i + 1} failed: ${err.message}`);
      }
    }

    throw new Error(`Transaction ${txHash} did not confirm within ${maxPolls * pollIntervalMs}ms`);
  }

  /**
   * Rebuild transaction with fresh sequence number from the network
   */
  private async rebuildTransactionWithFreshSequence(
    horizonServer: StellarSdk.Horizon.Server,
    originalTx: StellarSdk.Transaction,
    sourceKeypair: StellarSdk.Keypair,
  ): Promise<StellarSdk.Transaction> {
    // Load fresh account data
    const account = await horizonServer.loadAccount(sourceKeypair.publicKey());

    // Extract transaction details
    const operations = originalTx.operations;
    const fee = originalTx.fee;
    const networkPassphrase = originalTx.networkPassphrase;
    const memo = originalTx.memo;
    const timeBounds = originalTx.timeBounds;

    // Build new transaction with fresh sequence
    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: fee,
      networkPassphrase: networkPassphrase,
    });

    // Add all operations
    operations.forEach((op) => txBuilder.addOperation(op));

    // Add memo if present
    if (memo && memo.type !== StellarSdk.MemoNone) {
      txBuilder.addMemo(memo);
    }

    // Set timeout
    if (timeBounds) {
      txBuilder.setTimeout(Number(timeBounds.maxTime) - Number(timeBounds.minTime));
    } else {
      txBuilder.setTimeout(30);
    }

    const newTx = txBuilder.build();

    this.logger.log(
      `Rebuilt transaction with fresh sequence: old=${originalTx.sequence}, new=${newTx.sequence}`,
    );

    return newTx;
  }

  /**
   * Classify error type for appropriate handling
   */
  private classifyError(error: any): TransactionErrorType {
    const errorStr = JSON.stringify(error).toLowerCase();

    if (
      errorStr.includes('sequence') ||
      errorStr.includes('tx_bad_seq') ||
      errorStr.includes('bad_seq')
    ) {
      return TransactionErrorType.SEQUENCE_MISMATCH;
    }

    if (errorStr.includes('timeout') || errorStr.includes('timed out')) {
      return TransactionErrorType.TIMEOUT;
    }

    if (
      errorStr.includes('insufficient') ||
      errorStr.includes('fee') ||
      errorStr.includes('tx_insufficient_fee')
    ) {
      return TransactionErrorType.INSUFFICIENT_FEE;
    }

    if (
      errorStr.includes('network') ||
      errorStr.includes('connection') ||
      errorStr.includes('econnrefused') ||
      errorStr.includes('enotfound')
    ) {
      return TransactionErrorType.NETWORK_ERROR;
    }

    if (errorStr.includes('failed') || errorStr.includes('tx_failed')) {
      return TransactionErrorType.TRANSACTION_FAILED;
    }

    return TransactionErrorType.UNKNOWN;
  }

  /**
   * Determine if error type should trigger a retry
   */
  private shouldRetry(errorType: TransactionErrorType): boolean {
    switch (errorType) {
      case TransactionErrorType.SEQUENCE_MISMATCH:
      case TransactionErrorType.TIMEOUT:
      case TransactionErrorType.NETWORK_ERROR:
        return true;

      case TransactionErrorType.INSUFFICIENT_FEE:
      case TransactionErrorType.TRANSACTION_FAILED:
      case TransactionErrorType.UNKNOWN:
        return false;

      default:
        return false;
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
    const delay = Math.min(exponentialDelay + jitter, this.config.maxDelayMs);
    return Math.floor(delay);
  }

  /**
   * Wrap promise with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), timeoutMs)),
    ]);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
