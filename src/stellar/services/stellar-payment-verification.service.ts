import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { HttpIdempotencyEntity } from '../../idempotency/idempotency.entity';

export enum PaymentVerificationStatus {
  CONFIRMED = 'confirmed',
  FAILED    = 'failed',
  PENDING   = 'pending',
  EXPIRED   = 'expired',
  DUPLICATE = 'duplicate',
}

export interface PaymentVerificationResult {
  txHash:        string;
  status:        PaymentVerificationStatus;
  ledger?:       number;
  confirmedAt?:  string;
  errorMessage?: string;
}

/** Domain event emitted on successful on-chain payment confirmation. */
export const PAYMENT_CONFIRMED_EVENT = 'payment.confirmed';

export interface PaymentConfirmedEvent {
  txHash:     string;
  ledger:     number;
  confirmedAt: string;
  tenantId?:  string;
}

/** Transactions older than this threshold are treated as EXPIRED. */
const EXPIRY_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 h

/** Idempotency key prefix used in HttpIdempotencyEntity to namespace payment verifications. */
const IDEMPOTENCY_KEY_PREFIX = 'payment:verify:';

@Injectable()
export class StellarPaymentVerificationService {
  private readonly logger = new Logger(StellarPaymentVerificationService.name);
  private readonly horizonUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(HttpIdempotencyEntity)
    private readonly idempotencyRepo: Repository<HttpIdempotencyEntity>,
  ) {
    const network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.horizonUrl = network === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';
  }

  /**
   * Verify a Stellar transaction hash against the Horizon API.
   * Implements idempotency: repeated calls with the same txHash return the
   * cached result without re-hitting Horizon.
   * Emits `payment.confirmed` when a previously-unconfirmed payment succeeds.
   *
   * @param txHash   The Stellar transaction hash to verify.
   * @param tenantId Optional tenant context (propagated in the domain event).
   */
  async verifyPayment(
    txHash: string,
    tenantId?: string,
  ): Promise<PaymentVerificationResult> {
    // ── 1. Idempotency check + atomic claim ─────────────────────────────────
    // A plain SELECT-then-later-write leaves a window where two concurrent
    // calls for the same txHash (e.g. a webhook retry racing the original
    // delivery) both observe "no existing record", both hit Horizon, and
    // both emit PAYMENT_CONFIRMED_EVENT. `key` carries a unique index, so an
    // INSERT reserving the row is an atomic claim: only one concurrent
    // caller can win it, and everyone else is told to back off instead of
    // proceeding to call Horizon and emit the event a second time.
    const idempotencyKey = `${IDEMPOTENCY_KEY_PREFIX}${txHash}`;
    const claimed = await this.claimIdempotencyKey(idempotencyKey, txHash);

    if (!claimed) {
      const existing = await this.idempotencyRepo.findOne({ where: { key: idempotencyKey } });
      if (
        existing &&
        (existing.body as PaymentVerificationResult)?.status !== PaymentVerificationStatus.PENDING
      ) {
        this.logger.log(`[verifyPayment] Returning cached result for txHash=${txHash}`);
        return {
          ...(existing.body as PaymentVerificationResult),
          status: PaymentVerificationStatus.DUPLICATE,
        };
      }

      // Another call currently owns verification of this txHash (or left it
      // PENDING). Do not race it into a second Horizon lookup / event emit.
      this.logger.log(`[verifyPayment] Verification already in progress for txHash=${txHash}`);
      return { txHash, status: PaymentVerificationStatus.PENDING };
    }

    try {
      // ── 2. Query Horizon API ────────────────────────────────────────────
      let horizonData: any;
      try {
        const url = `${this.horizonUrl}/transactions/${txHash}`;
        const response = await firstValueFrom(this.httpService.get(url));
        horizonData = response.data;
      } catch (err: any) {
        if (err?.response?.status === 404) {
          this.logger.warn(`[verifyPayment] txHash=${txHash} not found on Horizon — treating as PENDING`);
          await this.releaseIdempotencyClaim(idempotencyKey);
          return { txHash, status: PaymentVerificationStatus.PENDING };
        }
        this.logger.error(`[verifyPayment] Horizon API error for txHash=${txHash}: ${err.message}`);
        await this.releaseIdempotencyClaim(idempotencyKey);
        throw err;
      }

      // ── 3. Classify transaction state ─────────────────────────────────────
      const result = this.classifyTransaction(txHash, horizonData);

      // ── 4. Persist idempotency record for confirmed/failed transactions ───
      if (
        result.status === PaymentVerificationStatus.CONFIRMED ||
        result.status === PaymentVerificationStatus.FAILED ||
        result.status === PaymentVerificationStatus.EXPIRED
      ) {
        await this.idempotencyRepo.update(
          { key: idempotencyKey },
          {
            statusCode: 200,
            body:       result as unknown as Record<string, any>,
          },
        );
      } else {
        // Still PENDING on-chain — release the claim so a legitimate later
        // retry (poll) can re-check Horizon instead of being stuck behind
        // a stale reservation forever.
        await this.releaseIdempotencyClaim(idempotencyKey);
      }

      // ── 5. Emit domain event for confirmed payments ────────────────────────
      if (result.status === PaymentVerificationStatus.CONFIRMED) {
        const event: PaymentConfirmedEvent = {
          txHash,
          ledger:     result.ledger!,
          confirmedAt: result.confirmedAt!,
          tenantId,
        };
        this.eventEmitter.emit(PAYMENT_CONFIRMED_EVENT, event);
        this.logger.log(`[verifyPayment] Emitted ${PAYMENT_CONFIRMED_EVENT} for txHash=${txHash}`);
      }

      return result;
    } catch (err) {
      // Don't leave a dangling claim behind on unexpected failures — a
      // permanently-stuck PENDING placeholder would block all future
      // verification attempts for this txHash.
      await this.releaseIdempotencyClaim(idempotencyKey).catch(() => {});
      throw err;
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Attempts to atomically reserve the idempotency row for this txHash.
   * Returns `true` if this call won the claim, `false` if another call
   * already holds (or previously completed) it.
   */
  private async claimIdempotencyKey(key: string, txHash: string): Promise<boolean> {
    try {
      await this.idempotencyRepo.insert({
        key,
        statusCode:         202,
        body:               { txHash, status: PaymentVerificationStatus.PENDING },
        headers:            {},
        requestFingerprint: `POST:/webhooks/stellar:${txHash}`,
      });
      return true;
    } catch (err: any) {
      if (this.isDuplicateKeyError(err)) {
        return false;
      }
      throw err;
    }
  }

  private async releaseIdempotencyClaim(key: string): Promise<void> {
    await this.idempotencyRepo.delete({ key });
  }

  private isDuplicateKeyError(error: unknown): boolean {
    const code =
      (error as { code?: string; driverError?: { code?: string } } | undefined)?.code ??
      (error as { driverError?: { code?: string } } | undefined)?.driverError?.code;
    return code === '23505';
  }

  private classifyTransaction(
    txHash: string,
    data: any,
  ): PaymentVerificationResult {
    if (!data.successful) {
      this.logger.warn(`[verifyPayment] txHash=${txHash} is FAILED on-chain`);
      return {
        txHash,
        status:       PaymentVerificationStatus.FAILED,
        errorMessage: data.result_xdr ?? 'Transaction failed on-chain',
      };
    }

    const createdAt = data.created_at ? new Date(data.created_at) : null;
    const ageMs     = createdAt ? Date.now() - createdAt.getTime() : 0;

    if (ageMs > EXPIRY_THRESHOLD_MS) {
      this.logger.warn(
        `[verifyPayment] txHash=${txHash} is EXPIRED (created_at=${data.created_at}, age=${ageMs}ms)`,
      );
      return {
        txHash,
        status:       PaymentVerificationStatus.EXPIRED,
        ledger:       data.ledger,
        confirmedAt:  data.created_at,
        errorMessage: 'Transaction exceeds the verification expiry window',
      };
    }

    this.logger.log(`[verifyPayment] txHash=${txHash} CONFIRMED on ledger ${data.ledger}`);
    return {
      txHash,
      status:      PaymentVerificationStatus.CONFIRMED,
      ledger:      data.ledger,
      confirmedAt: data.created_at,
    };
  }
}
