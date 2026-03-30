import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  StellarTransactionRetryService,
  TransactionContext,
} from './stellar-transaction-retry.service';

/**
 * Stellar Transaction Queue Service
 *
 * Manages a queue of failed transactions for retry scheduling
 * Provides transaction persistence and recovery mechanisms
 */

export interface QueuedTransaction {
  id: string;
  transaction: StellarSdk.Transaction;
  context: TransactionContext;
  sourcePublicKey: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  createdAt: Date;
  lastAttemptAt?: Date;
  lastError?: string;
  priority: TransactionPriority;
  status: TransactionStatus;
}

export enum TransactionPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  RETRYING = 'RETRYING',
  FAILED = 'FAILED',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

export interface QueueStats {
  total: number;
  pending: number;
  retrying: number;
  failed: number;
  completed: number;
  expired: number;
}

@Injectable()
export class StellarTransactionQueueService implements OnModuleInit {
  private readonly logger = new Logger(StellarTransactionQueueService.name);
  private readonly queue: Map<string, QueuedTransaction> = new Map();
  private readonly maxQueueSize: number;
  private readonly retryIntervalMs: number;
  private readonly transactionTTLMs: number;
  private retryTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly retryService: StellarTransactionRetryService,
  ) {
    this.maxQueueSize = parseInt(
      this.configService.get<string>('STELLAR_QUEUE_MAX_SIZE', '1000'),
      10,
    );
    this.retryIntervalMs = parseInt(
      this.configService.get<string>('STELLAR_QUEUE_RETRY_INTERVAL_MS', '30000'),
      10,
    );
    this.transactionTTLMs = parseInt(
      this.configService.get<string>('STELLAR_TRANSACTION_TTL_MS', '3600000'), // 1 hour
      10,
    );

    this.logger.log(
      `StellarTransactionQueueService initialized (maxSize: ${this.maxQueueSize}, retryInterval: ${this.retryIntervalMs}ms)`,
    );
  }

  onModuleInit() {
    this.startRetryScheduler();
  }

  /**
   * Add transaction to queue for retry
   */
  async enqueue(
    transaction: StellarSdk.Transaction,
    context: TransactionContext,
    sourcePublicKey: string,
    priority: TransactionPriority = TransactionPriority.NORMAL,
    maxAttempts: number = 5,
  ): Promise<string> {
    if (this.queue.size >= this.maxQueueSize) {
      throw new Error(
        `Transaction queue is full (max: ${this.maxQueueSize}). Cannot enqueue new transaction.`,
      );
    }

    const id = this.generateTransactionId(transaction);
    const now = new Date();

    const queuedTx: QueuedTransaction = {
      id,
      transaction,
      context,
      sourcePublicKey,
      attempts: 0,
      maxAttempts,
      nextRetryAt: now,
      createdAt: now,
      priority,
      status: TransactionStatus.PENDING,
    };

    this.queue.set(id, queuedTx);

    this.logger.log(
      `[${context.operation}] Transaction enqueued: ${id} (priority: ${priority}, queue size: ${this.queue.size})`,
    );

    return id;
  }

  /**
   * Remove transaction from queue
   */
  dequeue(id: string): boolean {
    const removed = this.queue.delete(id);
    if (removed) {
      this.logger.log(`Transaction dequeued: ${id}`);
    }
    return removed;
  }

  /**
   * Get transaction by ID
   */
  getTransaction(id: string): QueuedTransaction | undefined {
    return this.queue.get(id);
  }

  /**
   * Get all transactions with specific status
   */
  getTransactionsByStatus(status: TransactionStatus): QueuedTransaction[] {
    return Array.from(this.queue.values()).filter((tx) => tx.status === status);
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const transactions = Array.from(this.queue.values());

    return {
      total: transactions.length,
      pending: transactions.filter((tx) => tx.status === TransactionStatus.PENDING).length,
      retrying: transactions.filter((tx) => tx.status === TransactionStatus.RETRYING).length,
      failed: transactions.filter((tx) => tx.status === TransactionStatus.FAILED).length,
      completed: transactions.filter((tx) => tx.status === TransactionStatus.COMPLETED).length,
      expired: transactions.filter((tx) => tx.status === TransactionStatus.EXPIRED).length,
    };
  }

  /**
   * Clear completed and expired transactions
   */
  cleanup(): number {
    const before = this.queue.size;
    const now = Date.now();

    for (const [id, tx] of this.queue.entries()) {
      const shouldRemove =
        tx.status === TransactionStatus.COMPLETED ||
        tx.status === TransactionStatus.EXPIRED ||
        (tx.status === TransactionStatus.FAILED &&
          now - tx.createdAt.getTime() > this.transactionTTLMs);

      if (shouldRemove) {
        this.queue.delete(id);
      }
    }

    const removed = before - this.queue.size;
    if (removed > 0) {
      this.logger.log(`Cleanup removed ${removed} transactions from queue`);
    }

    return removed;
  }

  /**
   * Start automatic retry scheduler
   */
  private startRetryScheduler(): void {
    this.logger.log(`Starting retry scheduler (interval: ${this.retryIntervalMs}ms)`);

    this.retryTimer = setInterval(() => {
      this.processRetries().catch((err) => {
        this.logger.error(`Retry scheduler error: ${err.message}`, err.stack);
      });
    }, this.retryIntervalMs);
  }

  /**
   * Stop retry scheduler
   */
  stopRetryScheduler(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = undefined;
      this.logger.log('Retry scheduler stopped');
    }
  }

  /**
   * Process pending retries
   */
  private async processRetries(): Promise<void> {
    const now = new Date();
    const readyForRetry = Array.from(this.queue.values())
      .filter(
        (tx) =>
          (tx.status === TransactionStatus.PENDING || tx.status === TransactionStatus.RETRYING) &&
          tx.nextRetryAt <= now &&
          tx.attempts < tx.maxAttempts,
      )
      .sort((a, b) => {
        // Sort by priority (descending) then by nextRetryAt (ascending)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.nextRetryAt.getTime() - b.nextRetryAt.getTime();
      });

    if (readyForRetry.length === 0) {
      return;
    }

    this.logger.log(`Processing ${readyForRetry.length} transactions ready for retry`);

    // Process transactions (limit concurrent retries)
    const maxConcurrent = 5;
    for (let i = 0; i < readyForRetry.length; i += maxConcurrent) {
      const batch = readyForRetry.slice(i, i + maxConcurrent);
      await Promise.allSettled(batch.map((tx) => this.retryTransaction(tx)));
    }

    // Cleanup old transactions
    this.cleanup();
  }

  /**
   * Retry a single transaction
   */
  private async retryTransaction(queuedTx: QueuedTransaction): Promise<void> {
    const { id, transaction, context } = queuedTx;

    // Check if transaction has expired
    const age = Date.now() - queuedTx.createdAt.getTime();
    if (age > this.transactionTTLMs) {
      queuedTx.status = TransactionStatus.EXPIRED;
      this.logger.warn(`[${context.operation}] Transaction ${id} expired (age: ${age}ms)`);
      return;
    }

    queuedTx.status = TransactionStatus.RETRYING;
    queuedTx.attempts++;
    queuedTx.lastAttemptAt = new Date();

    this.logger.log(
      `[${context.operation}] Retrying transaction ${id} (attempt ${queuedTx.attempts}/${queuedTx.maxAttempts})`,
    );

    try {
      // Note: This is a simplified retry - in production, you'd need to inject
      // the actual Stellar servers and keypair
      // For now, we just update the status and schedule next retry

      // Simulate retry logic
      const nextRetryDelay = this.calculateNextRetryDelay(queuedTx.attempts);
      queuedTx.nextRetryAt = new Date(Date.now() + nextRetryDelay);

      // In a real implementation, you would call the retry service here
      // const result = await this.retryService.submitWithRetry(...);

      // For now, mark as pending for next retry
      if (queuedTx.attempts >= queuedTx.maxAttempts) {
        queuedTx.status = TransactionStatus.FAILED;
        this.logger.error(
          `[${context.operation}] Transaction ${id} failed after ${queuedTx.attempts} attempts`,
        );
      } else {
        queuedTx.status = TransactionStatus.PENDING;
      }
    } catch (err: any) {
      queuedTx.lastError = err.message;
      queuedTx.status = TransactionStatus.PENDING;

      const nextRetryDelay = this.calculateNextRetryDelay(queuedTx.attempts);
      queuedTx.nextRetryAt = new Date(Date.now() + nextRetryDelay);

      this.logger.warn(
        `[${context.operation}] Transaction ${id} retry failed: ${err.message}. Next retry at ${queuedTx.nextRetryAt.toISOString()}`,
      );
    }
  }

  /**
   * Calculate next retry delay with exponential backoff
   */
  private calculateNextRetryDelay(attempts: number): number {
    const baseDelay = 5000; // 5 seconds
    const maxDelay = 300000; // 5 minutes
    const exponentialDelay = baseDelay * Math.pow(2, attempts - 1);
    return Math.min(exponentialDelay, maxDelay);
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(transaction: StellarSdk.Transaction): string {
    const hash = transaction.hash().toString('hex');
    const timestamp = Date.now();
    return `${hash.substring(0, 16)}-${timestamp}`;
  }

  /**
   * Export queue state for persistence
   */
  exportQueue(): Array<{
    id: string;
    xdr: string;
    context: TransactionContext;
    sourcePublicKey: string;
    attempts: number;
    maxAttempts: number;
    nextRetryAt: string;
    createdAt: string;
    lastAttemptAt?: string;
    lastError?: string;
    priority: TransactionPriority;
    status: TransactionStatus;
  }> {
    return Array.from(this.queue.values()).map((tx) => ({
      id: tx.id,
      xdr: tx.transaction.toXDR(),
      context: tx.context,
      sourcePublicKey: tx.sourcePublicKey,
      attempts: tx.attempts,
      maxAttempts: tx.maxAttempts,
      nextRetryAt: tx.nextRetryAt.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      lastAttemptAt: tx.lastAttemptAt?.toISOString(),
      lastError: tx.lastError,
      priority: tx.priority,
      status: tx.status,
    }));
  }

  /**
   * Import queue state from persistence
   */
  importQueue(
    data: Array<{
      id: string;
      xdr: string;
      context: TransactionContext;
      sourcePublicKey: string;
      attempts: number;
      maxAttempts: number;
      nextRetryAt: string;
      createdAt: string;
      lastAttemptAt?: string;
      lastError?: string;
      priority: TransactionPriority;
      status: TransactionStatus;
    }>,
    networkPassphrase: string,
  ): number {
    let imported = 0;

    for (const item of data) {
      try {
        const transaction = StellarSdk.TransactionBuilder.fromXDR(
          item.xdr,
          networkPassphrase,
        ) as StellarSdk.Transaction;

        const queuedTx: QueuedTransaction = {
          id: item.id,
          transaction,
          context: item.context,
          sourcePublicKey: item.sourcePublicKey,
          attempts: item.attempts,
          maxAttempts: item.maxAttempts,
          nextRetryAt: new Date(item.nextRetryAt),
          createdAt: new Date(item.createdAt),
          lastAttemptAt: item.lastAttemptAt ? new Date(item.lastAttemptAt) : undefined,
          lastError: item.lastError,
          priority: item.priority,
          status: item.status,
        };

        this.queue.set(item.id, queuedTx);
        imported++;
      } catch (err: any) {
        this.logger.error(`Failed to import transaction ${item.id}: ${err.message}`);
      }
    }

    this.logger.log(`Imported ${imported} transactions into queue`);
    return imported;
  }
}
