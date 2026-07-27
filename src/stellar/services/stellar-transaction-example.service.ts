import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  StellarRecoveryManagerService,
  RecoveryOptions,
  RecoveryResult,
} from './stellar-recovery-manager.service';
import { TransactionPriority } from './stellar-transaction-queue.service';

/**
 * Example service demonstrating how to use the Stellar transaction retry and recovery system
 *
 * This service shows practical usage patterns for:
 * - Submitting transactions with automatic retry
 * - Handling different priority levels
 * - Managing failed transactions
 * - Monitoring transaction status
 */

@Injectable()
export class StellarTransactionExampleService {
  private readonly logger = new Logger(StellarTransactionExampleService.name);
  private readonly server: StellarSdk.SorobanRpc.Server;
  private readonly horizonServer: StellarSdk.Horizon.Server;
  private readonly networkPassphrase: string;
  private readonly sourceKeypair: StellarSdk.Keypair;

  constructor(
    private readonly configService: ConfigService,
    private readonly recoveryManager: StellarRecoveryManagerService,
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

    this.server = new StellarSdk.SorobanRpc.Server(sorobanRpcUrl, { allowHttp: false });
    this.horizonServer = new StellarSdk.Horizon.Server(horizonUrl, { allowHttp: false });

    const secretKey = this.configService.get<string>('STELLAR_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STELLAR_SECRET_KEY is required');
    }
    this.sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);

    this.logger.log('StellarTransactionExampleService initialized');
  }

  /**
   * Example 1: Submit a critical transaction with high priority
   * Use case: Emergency medical record access grant
   */
  async submitCriticalTransaction(
    contractId: string,
    method: string,
    args: StellarSdk.xdr.ScVal[],
  ): Promise<RecoveryResult> {
    this.logger.log(`Submitting critical transaction: ${method}`);

    const transaction = await this.buildContractTransaction(contractId, method, args);

    const options: RecoveryOptions = {
      priority: TransactionPriority.CRITICAL,
      maxAttempts: 10, // More retries for critical operations
      enableQueueing: true,
      metadata: {
        type: 'critical',
        method,
        timestamp: new Date().toISOString(),
      },
    };

    return this.recoveryManager.submitWithRecovery(
      this.server,
      this.horizonServer,
      transaction,
      this.sourceKeypair,
      { operation: method, metadata: { critical: true } },
      options,
    );
  }

  /**
   * Example 2: Submit a normal priority transaction
   * Use case: Regular medical record anchoring
   */
  async submitNormalTransaction(
    contractId: string,
    method: string,
    args: StellarSdk.xdr.ScVal[],
  ): Promise<RecoveryResult> {
    this.logger.log(`Submitting normal transaction: ${method}`);

    const transaction = await this.buildContractTransaction(contractId, method, args);

    const options: RecoveryOptions = {
      priority: TransactionPriority.NORMAL,
      maxAttempts: 5,
      enableQueueing: true,
      metadata: {
        type: 'normal',
        method,
      },
    };

    return this.recoveryManager.submitWithRecovery(
      this.server,
      this.horizonServer,
      transaction,
      this.sourceKeypair,
      { operation: method },
      options,
    );
  }

  /**
   * Example 3: Submit a low priority transaction without queueing
   * Use case: Non-critical analytics or logging
   */
  async submitLowPriorityTransaction(
    contractId: string,
    method: string,
    args: StellarSdk.xdr.ScVal[],
  ): Promise<RecoveryResult> {
    this.logger.log(`Submitting low priority transaction: ${method}`);

    const transaction = await this.buildContractTransaction(contractId, method, args);

    const options: RecoveryOptions = {
      priority: TransactionPriority.LOW,
      maxAttempts: 3,
      enableQueueing: false, // Don't queue low priority transactions
      metadata: {
        type: 'low_priority',
        method,
      },
    };

    return this.recoveryManager.submitWithRecovery(
      this.server,
      this.horizonServer,
      transaction,
      this.sourceKeypair,
      { operation: method },
      options,
    );
  }

  /**
   * Example 4: Check status of a queued transaction
   */
  async checkQueuedTransactionStatus(queueId: string) {
    const status = this.recoveryManager.getQueuedTransactionStatus(queueId);

    if (!status) {
      this.logger.warn(`Transaction not found in queue: ${queueId}`);
      return null;
    }

    this.logger.log(
      `Transaction ${queueId} status: ${status.status} (attempts: ${status.attempts}/${status.maxAttempts})`,
    );

    return {
      id: status.id,
      status: status.status,
      attempts: status.attempts,
      maxAttempts: status.maxAttempts,
      nextRetryAt: status.nextRetryAt,
      lastError: status.lastError,
      priority: status.priority,
    };
  }

  /**
   * Example 5: Manually retry a failed transaction
   */
  async retryFailedTransaction(queueId: string): Promise<RecoveryResult> {
    this.logger.log(`Manually retrying failed transaction: ${queueId}`);

    return this.recoveryManager.retryFailedTransaction(
      queueId,
      this.server,
      this.horizonServer,
      this.sourceKeypair,
    );
  }

  /**
   * Example 6: Get all failed transactions for manual review
   */
  async getFailedTransactions() {
    const failed = this.recoveryManager.getFailedTransactions();

    this.logger.log(`Found ${failed.length} failed transactions`);

    return failed.map((tx) => ({
      id: tx.id,
      operation: tx.context.operation,
      attempts: tx.attempts,
      lastError: tx.lastError,
      createdAt: tx.createdAt,
      priority: tx.priority,
    }));
  }

  /**
   * Example 7: Get system health and statistics
   */
  async getSystemHealth() {
    const health = await this.recoveryManager.healthCheck();
    const stats = this.recoveryManager.getStats();
    const queueStats = this.recoveryManager.getQueueStats();

    this.logger.log(`System health: ${health.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);

    return {
      healthy: health.healthy,
      recovery: {
        totalSubmissions: stats.totalSubmissions,
        successRate:
          stats.totalSubmissions > 0
            ? (stats.successfulSubmissions / stats.totalSubmissions) * 100
            : 0,
        averageAttempts: stats.averageAttempts,
        averageDurationMs: stats.averageSuccessDurationMs,
      },
      queue: {
        total: queueStats.total,
        pending: queueStats.pending,
        retrying: queueStats.retrying,
        failed: queueStats.failed,
        completed: queueStats.completed,
      },
    };
  }

  /**
   * Example 8: Batch submit multiple transactions
   */
  async batchSubmitTransactions(
    transactions: Array<{
      contractId: string;
      method: string;
      args: StellarSdk.xdr.ScVal[];
      priority?: TransactionPriority;
    }>,
  ): Promise<RecoveryResult[]> {
    this.logger.log(`Batch submitting ${transactions.length} transactions`);

    const results = await Promise.allSettled(
      transactions.map(async (tx) => {
        const transaction = await this.buildContractTransaction(tx.contractId, tx.method, tx.args);

        return this.recoveryManager.submitWithRecovery(
          this.server,
          this.horizonServer,
          transaction,
          this.sourceKeypair,
          { operation: tx.method },
          {
            priority: tx.priority || TransactionPriority.NORMAL,
            maxAttempts: 5,
            enableQueueing: true,
          },
        );
      }),
    );

    return results.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : {
            success: false,
            attempts: 0,
            queuedForRetry: false,
            error: result.reason?.message || 'Unknown error',
          },
    );
  }

  /**
   * Helper: Build a contract invocation transaction
   */
  private async buildContractTransaction(
    contractId: string,
    method: string,
    args: StellarSdk.xdr.ScVal[],
  ): Promise<StellarSdk.Transaction> {
    const account = await this.horizonServer.loadAccount(this.sourceKeypair.publicKey());
    const contract = new StellarSdk.Contract(contractId);
    const operation = contract.call(method, ...args);

    const feeBudget = parseInt(
      this.configService.get<string>('STELLAR_FEE_BUDGET', '10000000'),
      10,
    );

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: feeBudget.toString(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    // Simulate to prepare transaction
    const simResult = await this.server.simulateTransaction(tx);

    if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Simulation failed for "${method}": ${simResult.error}`);
    }

    return StellarSdk.SorobanRpc.assembleTransaction(tx, simResult).build();
  }
}
