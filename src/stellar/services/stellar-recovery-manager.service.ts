import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  StellarTransactionRetryService,
  TransactionSubmissionResult,
  TransactionContext,
  TransactionErrorType,
} from './stellar-transaction-retry.service';
import {
  StellarTransactionQueueService,
  TransactionPriority,
  TransactionStatus,
  QueuedTransaction,
} from './stellar-transaction-queue.service';

/**
 * Stellar Recovery Manager Service
 *
 * High-level orchestration service that combines retry logic and queue management
 * Provides a unified interface for robust transaction submission with automatic recovery
 */

export interface RecoveryOptions {
  priority?: TransactionPriority;
  maxAttempts?: number;
  enableQueueing?: boolean;
  metadata?: Record<string, any>;
}

export interface RecoveryResult {
  success: boolean;
  txHash?: string;
  ledger?: number;
  attempts: number;
  queuedForRetry: boolean;
  queueId?: string;
  error?: string;
  errorType?: TransactionErrorType;
}

export interface RecoveryStats {
  totalSubmissions: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  queuedTransactions: number;
  averageAttempts: number;
  averageSuccessDurationMs: number;
}

@Injectable()
export class StellarRecoveryManagerService {
  private readonly logger = new Logger(StellarRecoveryManagerService.name);
  private readonly stats: RecoveryStats = {
    totalSubmissions: 0,
    successfulSubmissions: 0,
    failedSubmissions: 0,
    queuedTransactions: 0,
    averageAttempts: 0,
    averageSuccessDurationMs: 0,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly retryService: StellarTransactionRetryService,
    private readonly queueService: StellarTransactionQueueService,
  ) {
    this.logger.log('StellarRecoveryManagerService initialized');
  }

  /**
   * Submit transaction with full recovery capabilities
   *
   * This is the main entry point for transaction submission with:
   * - Automatic retry with exponential backoff
   * - Sequence number conflict resolution
   * - Optional queueing for failed transactions
   * - Comprehensive error handling and classification
   */
  async submitWithRecovery(
    server: StellarSdk.SorobanRpc.Server,
    horizonServer: StellarSdk.Horizon.Server,
    transaction: StellarSdk.Transaction,
    sourceKeypair: StellarSdk.Keypair,
    context: TransactionContext,
    options: RecoveryOptions = {},
  ): Promise<RecoveryResult> {
    const {
      priority = TransactionPriority.NORMAL,
      maxAttempts = 5,
      enableQueueing = true,
      metadata = {},
    } = options;

    this.stats.totalSubmissions++;

    this.logger.log(
      `[${context.operation}] Submitting transaction with recovery (priority: ${priority}, queueing: ${enableQueueing})`,
    );

    // Attempt submission with retry logic
    const result = await this.retryService.submitWithRetry(
      server,
      horizonServer,
      transaction,
      sourceKeypair,
      { ...context, metadata },
    );

    // Update statistics
    this.updateStats(result);

    // Handle successful submission
    if (result.success) {
      this.logger.log(
        `[${context.operation}] Transaction submitted successfully: ${result.txHash} (attempts: ${result.attempts})`,
      );

      return {
        success: true,
        txHash: result.txHash,
        ledger: result.ledger,
        attempts: result.attempts,
        queuedForRetry: false,
      };
    }

    // Handle failed submission
    this.logger.warn(
      `[${context.operation}] Transaction submission failed after ${result.attempts} attempts: ${result.error}`,
    );

    // Queue for retry if enabled and error is retryable
    let queueId: string | undefined;
    let queuedForRetry = false;

    if (enableQueueing && this.shouldQueueForRetry(result.errorType)) {
      try {
        queueId = await this.queueService.enqueue(
          transaction,
          { ...context, metadata },
          sourceKeypair.publicKey(),
          priority,
          maxAttempts,
        );

        queuedForRetry = true;
        this.stats.queuedTransactions++;

        this.logger.log(`[${context.operation}] Transaction queued for retry: ${queueId}`);
      } catch (queueErr: any) {
        this.logger.error(
          `[${context.operation}] Failed to queue transaction: ${queueErr.message}`,
        );
      }
    }

    return {
      success: false,
      attempts: result.attempts,
      queuedForRetry,
      queueId,
      error: result.error,
      errorType: result.errorType,
    };
  }

  /**
   * Check status of a queued transaction
   */
  getQueuedTransactionStatus(queueId: string): QueuedTransaction | undefined {
    return this.queueService.getTransaction(queueId);
  }

  /**
   * Cancel a queued transaction
   */
  cancelQueuedTransaction(queueId: string): boolean {
    const tx = this.queueService.getTransaction(queueId);
    if (!tx) {
      return false;
    }

    const removed = this.queueService.dequeue(queueId);
    if (removed) {
      this.logger.log(`Cancelled queued transaction: ${queueId}`);
    }

    return removed;
  }

  /**
   * Get all failed transactions
   */
  getFailedTransactions(): QueuedTransaction[] {
    return this.queueService.getTransactionsByStatus(TransactionStatus.FAILED);
  }

  /**
   * Get all pending transactions
   */
  getPendingTransactions(): QueuedTransaction[] {
    return this.queueService.getTransactionsByStatus(TransactionStatus.PENDING);
  }

  /**
   * Manually retry a failed transaction
   */
  async retryFailedTransaction(
    queueId: string,
    server: StellarSdk.SorobanRpc.Server,
    horizonServer: StellarSdk.Horizon.Server,
    sourceKeypair: StellarSdk.Keypair,
  ): Promise<RecoveryResult> {
    const queuedTx = this.queueService.getTransaction(queueId);

    if (!queuedTx) {
      throw new Error(`Transaction not found in queue: ${queueId}`);
    }

    if (queuedTx.status !== TransactionStatus.FAILED) {
      throw new Error(
        `Transaction ${queueId} is not in FAILED status (current: ${queuedTx.status})`,
      );
    }

    this.logger.log(
      `[${queuedTx.context.operation}] Manually retrying failed transaction: ${queueId}`,
    );

    // Remove from queue and retry
    this.queueService.dequeue(queueId);

    return this.submitWithRecovery(
      server,
      horizonServer,
      queuedTx.transaction,
      sourceKeypair,
      queuedTx.context,
      {
        priority: queuedTx.priority,
        maxAttempts: queuedTx.maxAttempts,
        enableQueueing: true,
      },
    );
  }

  /**
   * Get recovery statistics
   */
  getStats(): RecoveryStats {
    return { ...this.stats };
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return this.queueService.getStats();
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.totalSubmissions = 0;
    this.stats.successfulSubmissions = 0;
    this.stats.failedSubmissions = 0;
    this.stats.queuedTransactions = 0;
    this.stats.averageAttempts = 0;
    this.stats.averageSuccessDurationMs = 0;

    this.logger.log('Recovery statistics reset');
  }

  /**
   * Determine if transaction should be queued for retry based on error type
   */
  private shouldQueueForRetry(errorType?: TransactionErrorType): boolean {
    if (!errorType) {
      return false;
    }

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
   * Update internal statistics
   */
  private updateStats(result: TransactionSubmissionResult): void {
    if (result.success) {
      this.stats.successfulSubmissions++;

      // Update average attempts
      const totalAttempts =
        this.stats.averageAttempts * (this.stats.successfulSubmissions - 1) + result.attempts;
      this.stats.averageAttempts = totalAttempts / this.stats.successfulSubmissions;

      // Update average duration
      const totalDuration =
        this.stats.averageSuccessDurationMs * (this.stats.successfulSubmissions - 1) +
        result.totalDurationMs;
      this.stats.averageSuccessDurationMs = totalDuration / this.stats.successfulSubmissions;
    } else {
      this.stats.failedSubmissions++;
    }
  }

  /**
   * Export queue state for persistence
   */
  exportQueueState() {
    return this.queueService.exportQueue();
  }

  /**
   * Import queue state from persistence
   */
  importQueueState(data: any[], networkPassphrase: string): number {
    return this.queueService.importQueue(data, networkPassphrase);
  }

  /**
   * Health check for recovery system
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    queueSize: number;
    pendingRetries: number;
    failedTransactions: number;
    stats: RecoveryStats;
  }> {
    const queueStats = this.queueService.getStats();

    return {
      healthy: queueStats.total < 900, // Warn if queue is near capacity
      queueSize: queueStats.total,
      pendingRetries: queueStats.pending + queueStats.retrying,
      failedTransactions: queueStats.failed,
      stats: this.getStats(),
    };
  }
}
