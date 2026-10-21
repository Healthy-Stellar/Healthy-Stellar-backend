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

/**
 * The payment a transaction hash is expected to settle. Every field is
 * required so a hash can never be confirmed against an unrelated transfer.
 */
export interface ExpectedPayment {
  /** Stellar account (G...) the payment must be sent to. */
  destination: string;
  /** Asset identifier: `native` for XLM, otherwise `CODE:ISSUER`. */
  asset:       string;
  /** Expected amount as a decimal string (e.g. "10.0000000"). */
  amount:      string;
  /** Invoice identifier that must be present in the transaction memo. */
  memo:        string;
  /** Invoice this tx hash is bound to (one hash ↔ one invoice). */
  invoiceId:   string;
}

/** Domain event emitted on successful on-chain payment confirmation. */
export const PAYMENT_CONFIRMED_EVENT = 'payment.confirmed';

export interface PaymentConfirmedEvent {
  txHash:     string;
  ledger:     number;
  confirmedAt: string;
  tenantId?:  string;
}

/** Idempotency key prefix used in HttpIdempotencyEntity to namespace payment verifications. */
const IDEMPOTENCY_KEY_PREFIX = 'payment:verify:';

/** Idempotency key prefix binding a tx hash to the invoice it settles. */
const INVOICE_BINDING_KEY_PREFIX = 'payment:invoice:';

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
   * Verify a Stellar transaction hash against the Horizon API and confirm it
   * actually settles the expected payment (destination, asset, amount, memo).
   * Implements idempotency: repeated calls with the same txHash return the
   * cached result without re-hitting Horizon.
   * Emits `payment.confirmed` when a previously-unconfirmed payment succeeds.
   *
   * @param txHash   The Stellar transaction hash to verify.
   * @param expected The payment the hash is expected to settle.
   * @param tenantId Optional tenant context (propagated in the domain event).
   */
  async verifyPayment(
    txHash: string,
    expected: ExpectedPayment,
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
      const existingBody = existing?.body as PaymentVerificationResult | undefined;

      if (existingBody && existingBody.status !== PaymentVerificationStatus.PENDING) {
        // A hash already bound to a *different* invoice is a reuse attempt.
        const boundInvoiceId = (existingBody as any)?.invoiceId as string | undefined;
        if (boundInvoiceId && boundInvoiceId !== expected.invoiceId) {
          this.logger.warn(
            `[verifyPayment] txHash=${txHash} already bound to invoice=${boundInvoiceId}, ` +
            `rejecting reuse for invoice=${expected.invoiceId}`,
          );
          return {
            txHash,
            status:       PaymentVerificationStatus.DUPLICATE,
            errorMessage: 'Transaction hash already used for a different invoice',
          };
        }

        this.logger.log(`[verifyPayment] Returning cached result for txHash=${txHash}`);
        return {
          ...existingBody,
          status: PaymentVerificationStatus.DUPLICATE,
        };
      }

      // Another call currently owns verification of this txHash (or left it
      // PENDING). Do not race it into a second Horizon lookup / event emit.
      this.logger.log(`[verifyPayment] Verification already in progress for txHash=${txHash}`);
      return { txHash, status: PaymentVerificationStatus.PENDING };
    }

    try {
      // ── 2. Bind tx hash to a single invoice (unique) ──────────────────────
      const bound = await this.bindHashToInvoice(txHash, expected.invoiceId);
      if (!bound) {
        this.logger.warn(
          `[verifyPayment] txHash=${txHash} is already bound to another invoice — rejecting reuse`,
        );
        await this.releaseIdempotencyClaim(idempotencyKey);
        return {
          txHash,
          status:       PaymentVerificationStatus.DUPLICATE,
          errorMessage: 'Transaction hash already used for a different invoice',
        };
      }

      // ── 3. Query Horizon API ────────────────────────────────────────────
      let horizonData: any;
      let operations: any[];
      try {
        const txUrl = `${this.horizonUrl}/transactions/${txHash}`;
        const txResponse = await firstValueFrom(this.httpService.get(txUrl));
        horizonData = txResponse.data;

        const opsUrl = `${this.horizonUrl}/transactions/${txHash}/operations`;
        const opsResponse = await firstValueFrom(this.httpService.get(opsUrl));
        operations = opsResponse.data?._embedded?.records ?? [];
      } catch (err: any) {
        if (err?.response?.status === 404) {
          this.logger.warn(`[verifyPayment] txHash=${txHash} not found on Horizon — treating as PENDING`);
          await this.releaseIdempotencyClaim(idempotencyKey);
          await this.releaseInvoiceBinding(txHash, expected.invoiceId);
          return { txHash, status: PaymentVerificationStatus.PENDING };
        }
        this.logger.error(`[verifyPayment] Horizon API error for txHash=${txHash}: ${err.message}`);
        await this.releaseIdempotencyClaim(idempotencyKey);
        await this.releaseInvoiceBinding(txHash, expected.invoiceId);
        throw err;
      }

      // ── 4. Classify transaction state against the expected payment ────────
      const result = this.classifyTransaction(txHash, horizonData, operations, expected);

      // ── 5. Persist idempotency record for confirmed/failed transactions ───
      // EXPIRED is no longer produced; old transactions stay verifiable.
      if (
        result.status === PaymentVerificationStatus.CONFIRMED ||
        result.status === PaymentVerificationStatus.FAILED
      ) {
        await this.idempotencyRepo.update(
          { key: idempotencyKey },
          {
            statusCode: 200,
            body:       { ...result, invoiceId: expected.invoiceId } as unknown as Record<string, any>,
          },
        );
      } else {
        // Still PENDING on-chain — release the claim so a legitimate later
        // retry (poll) can re-check Horizon instead of being stuck behind
        // a stale reservation forever.
        await this.releaseIdempotencyClaim(idempotencyKey);
        await this.releaseInvoiceBinding(txHash, expected.invoiceId);
      }

      // ── 6. Emit domain event for confirmed payments ────────────────────────
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
      await this.releaseInvoiceBinding(txHash, expected.invoiceId).catch(() => {});
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

  /**
   * Atomically binds a tx hash to a single invoice. Returns `false` when the
   * hash is already bound to a different invoice (reuse attempt).
   */
  private async bindHashToInvoice(txHash: string, invoiceId: string): Promise<boolean> {
    const key = `${INVOICE_BINDING_KEY_PREFIX}${txHash}`;
    try {
      await this.idempotencyRepo.insert({
        key,
        statusCode:         200,
        body:               { txHash, invoiceId },
        headers:            {},
        requestFingerprint: `POST:/webhooks/stellar:invoice:${invoiceId}`,
      });
      return true;
    } catch (err: any) {
      if (this.isDuplicateKeyError(err)) {
        const existing = await this.idempotencyRepo.findOne({ where: { key } });
        const boundInvoiceId = (existing?.body as any)?.invoiceId as string | undefined;
        return boundInvoiceId === invoiceId;
      }
      throw err;
    }
  }

  private async releaseInvoiceBinding(txHash: string, invoiceId: string): Promise<void> {
    const key = `${INVOICE_BINDING_KEY_PREFIX}${txHash}`;
    const existing = await this.idempotencyRepo.findOne({ where: { key } });
    const boundInvoiceId = (existing?.body as any)?.invoiceId as string | undefined;
    if (existing && boundInvoiceId === invoiceId) {
      await this.idempotencyRepo.delete({ key });
    }
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
    operations: any[],
    expected: ExpectedPayment,
  ): PaymentVerificationResult {
    if (!data.successful) {
      this.logger.warn(`[verifyPayment] txHash=${txHash} is FAILED on-chain`);
      return {
        txHash,
        status:       PaymentVerificationStatus.FAILED,
        errorMessage: data.result_xdr ?? 'Transaction failed on-chain',
      };
    }

    const match = operations.find((op) => this.matchesExpectedPayment(op, expected));
    if (!match) {
      this.logger.warn(
        `[verifyPayment] txHash=${txHash} has no payment operation matching ` +
        `destination=${expected.destination} asset=${expected.asset} ` +
        `amount=${expected.amount} memo=${expected.memo}`,
      );
      return {
        txHash,
        status:       PaymentVerificationStatus.FAILED,
        ledger:       data.ledger,
        confirmedAt:  data.created_at,
        errorMessage: 'No matching payment operation found in transaction',
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

  /**
   * Returns true when a Horizon operation is a payment that matches the
   * expected destination, asset and amount, and the enclosing transaction
   * carries the expected memo.
   */
  private matchesExpectedPayment(op: any, expected: ExpectedPayment): boolean {
    if (!op || op.type !== 'payment') {
      return false;
    }
    if (op.to !== expected.destination) {
      return false;
    }
    if (!this.assetMatches(op.asset_type, op.asset_code, op.asset_issuer, expected.asset)) {
      return false;
    }
    if (!this.amountMatches(op.amount, expected.amount)) {
      return false;
    }
    return this.memoMatches(op, expected.memo);
  }

  private assetMatches(
    assetType: string | undefined,
    assetCode: string | undefined,
    assetIssuer: string | undefined,
    expected: string,
  ): boolean {
    if (expected === 'native') {
      return assetType === 'native';
    }
    const [code, issuer] = expected.split(':');
    return (
      assetType !== 'native' &&
      assetCode === code &&
      assetIssuer === issuer
    );
  }

  private amountMatches(actual: string | undefined, expected: string): boolean {
    const actualNum = Number(actual);
    const expectedNum = Number(expected);
    if (!Number.isFinite(actualNum) || !Number.isFinite(expectedNum)) {
      return false;
    }
    // Stellar amounts are fixed-precision (7 decimals); compare with a small
    // tolerance to avoid float representation drift.
    return Math.abs(actualNum - expectedNum) < 1e-7;
  }

  private memoMatches(op: any, expectedMemo: string): boolean {
    // Horizon embeds the transaction memo on each operation record.
    const memo = op.memo ?? op.transaction_memo;
    if (memo === undefined || memo === null) {
      return false;
    }
    return String(memo) === String(expectedMemo);
  }
}
