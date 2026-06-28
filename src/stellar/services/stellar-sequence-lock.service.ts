import { Injectable, Logger } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import { RedisLockService } from '../../common/utils/redis-lock.service';
import { StellarTracingService } from './stellar-tracing.service';

/**
 * Serializes Stellar transaction submission per source account using a Redis lock,
 * preventing concurrent submitters from racing on the same sequence number.
 * On a `tx_bad_seq` rejection it refreshes the account's sequence from Horizon and
 * retries exactly once, logging each retry attempt as an OpenTelemetry span event.
 */
@Injectable()
export class StellarSequenceLockService {
  private readonly logger = new Logger(StellarSequenceLockService.name);
  private static readonly LOCK_TTL_MS = 30_000;
  private static readonly LOCK_ACQUIRE_TIMEOUT_MS = 30_000;
  private static readonly LOCK_RETRY_DELAY_MS = 100;

  constructor(
    private readonly redisLock: RedisLockService,
    private readonly tracingService: StellarTracingService,
  ) {}

  async submitWithSequenceLock(
    horizonServer: StellarSdk.Horizon.Server,
    sourceKeypair: StellarSdk.Keypair,
    buildTransaction: (account: any) => StellarSdk.Transaction,
    operation: string,
  ): Promise<any> {
    const lockKey = `stellar:seq-lock:${sourceKeypair.publicKey()}`;
    await this.acquireLockOrThrow(lockKey, operation);

    try {
      const account = await horizonServer.loadAccount(sourceKeypair.publicKey());
      const transaction = buildTransaction(account);
      transaction.sign(sourceKeypair);

      try {
        return await horizonServer.submitTransaction(transaction);
      } catch (err: any) {
        if (!this.isBadSequence(err)) {
          throw err;
        }

        this.tracingService.addRetryEvent(operation, 1, 1, 'tx_bad_seq');
        this.logger.warn(
          `[${operation}] tx_bad_seq for ${sourceKeypair.publicKey()}, refreshing sequence and retrying once`,
        );

        const refreshedAccount = await horizonServer.loadAccount(sourceKeypair.publicKey());
        const retryTransaction = buildTransaction(refreshedAccount);
        retryTransaction.sign(sourceKeypair);

        return await horizonServer.submitTransaction(retryTransaction);
      }
    } finally {
      await this.redisLock.releaseLock(lockKey);
    }
  }

  private async acquireLockOrThrow(lockKey: string, operation: string): Promise<void> {
    const deadline = Date.now() + StellarSequenceLockService.LOCK_ACQUIRE_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const acquired = await this.redisLock.acquireLock(
        lockKey,
        StellarSequenceLockService.LOCK_TTL_MS,
      );
      if (acquired) {
        return;
      }
      await this.sleep(StellarSequenceLockService.LOCK_RETRY_DELAY_MS);
    }

    throw new Error(`[${operation}] Timed out waiting for sequence lock on ${lockKey}`);
  }

  private isBadSequence(error: any): boolean {
    const resultCodes = error?.response?.data?.extras?.result_codes;
    if (resultCodes?.transaction === 'tx_bad_seq') {
      return true;
    }
    const serialized = JSON.stringify(error?.response?.data ?? error?.message ?? error ?? '');
    return serialized.toLowerCase().includes('tx_bad_seq');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
