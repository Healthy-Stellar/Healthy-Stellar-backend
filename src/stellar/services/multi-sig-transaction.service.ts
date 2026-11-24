import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository, LessThan, IsNull } from 'typeorm';
import { MultiSigTransactionEntity } from '../entities/multi-sig-transaction.entity';
import {
  MultiSigTransactionStatus,
  SignatureStatus,
  CreateMultiSigPaymentDto,
  MultiSigTransactionResponse,
} from '../interfaces/multi-sig.interface';
import { StellarPaymentService } from './stellar-payment.service';
import { StellarPaymentError } from './stellar.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { NotificationEventType } from '../../notifications/interfaces/notification-event.interface';
import {
  MULTI_SIG_EXECUTE_JOB,
  MULTI_SIG_EXECUTION_QUEUE,
  MultiSigExecutionQueue,
} from '../multi-sig.constants';

const DEFAULT_THRESHOLD = '10000';
const DEFAULT_QUORUM = 2;
const DEFAULT_TOTAL_SIGNERS = 3;
const DEFAULT_TTL_MINUTES = 60;
const DEFAULT_MAX_EXECUTION_ATTEMPTS = 5;

/** Substrings of legacy (non-StellarPaymentError) messages that are never worth retrying. */
const TERMINAL_ERROR_MARKERS = ['Invalid destination', 'insufficient funds', 'invalid asset'];

@Injectable()
export class MultiSigTransactionService {
  private readonly logger = new Logger(MultiSigTransactionService.name);

  constructor(
    @InjectRepository(MultiSigTransactionEntity)
    private readonly repo: Repository<MultiSigTransactionEntity>,
    private readonly config: ConfigService,
    private readonly paymentService: StellarPaymentService,
    @InjectQueue(MULTI_SIG_EXECUTION_QUEUE)
    private readonly executionQueue: MultiSigExecutionQueue,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createMultiSigPayment(dto: CreateMultiSigPaymentDto, requesterId: string, tenantId: string): Promise<MultiSigTransactionResponse> {
    const thresholdAmount = this.config.get<string>('MULTI_SIG_THRESHOLD_' + tenantId, DEFAULT_THRESHOLD);
    if (BigInt(dto.amount) < BigInt(thresholdAmount)) throw new BadRequestException('Amount below threshold');
    const quorumSize = parseInt(this.config.get<string>('MULTI_SIG_QUORUM_' + tenantId) || String(DEFAULT_QUORUM), 10);
    const signers = (this.config.get<string>('MULTI_SIG_SIGNERS_' + tenantId, '') || '').split(',').filter(Boolean).map(s => s.trim());
    const ttlMinutes = parseInt(this.config.get<string>('MULTI_SIG_TTL_MINUTES_' + tenantId) || String(DEFAULT_TTL_MINUTES), 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60000);
    const entity = this.repo.create({
      tenantId, destination: dto.destination, amount: dto.amount,
      asset: dto.asset || 'XLM', status: MultiSigTransactionStatus.PENDING_SIGNATURES,
      threshold: quorumSize, totalSigners: signers.length || DEFAULT_TOTAL_SIGNERS, ttlMinutes, expiresAt,
      requesterId, signatures: signers.map(s => ({ signerId: s, status: SignatureStatus.PENDING })), memo: dto.memo,
    });
    const saved = await this.repo.save(entity);
    signers.forEach(s => this.notificationsGateway.emitNotification({
      eventType: NotificationEventType.MULTI_SIG_PAYMENT_AWAITING,
      actorId: requesterId,
      resourceId: saved.id,
      timestamp: new Date(),
      metadata: { targetUserId: s, transactionId: saved.id, amount: dto.amount, asset: saved.asset, destination: dto.destination },
    }));
    return this.toResponse(saved);
  }

  /**
   * Record a signer's approval. When quorum is reached the transaction moves
   * to APPROVED and an execution job is enqueued.
   *
   * The read-modify-write runs inside a DB transaction holding a row lock, so
   * concurrent approvals can't overwrite each other's signatures.
   */
  async approveTransaction(transactionId: string, tenantId: string, signerId: string): Promise<MultiSigTransactionResponse> {
    const outcome = await this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(MultiSigTransactionEntity);
      const entity = await repo.findOne({ where: { id: transactionId, tenantId }, lock: { mode: 'pessimistic_write' } });
      if (!entity) throw new NotFoundException('Not found');
      if (entity.status !== MultiSigTransactionStatus.PENDING_SIGNATURES) { throw new BadRequestException('Already ' + entity.status); }
      if (new Date() > entity.expiresAt) {
        // Persist the expiry before rejecting, so the error must not roll it back.
        entity.status = MultiSigTransactionStatus.EXPIRED;
        await repo.save(entity);
        return { entity, expired: true, reachedQuorum: false };
      }
      const se = entity.signatures?.find(s => s.signerId === signerId);
      if (!se) throw new ForbiddenException('Not authorised');
      if (se.status === SignatureStatus.REJECTED) throw new BadRequestException('Already rejected');
      if (se.status === SignatureStatus.APPROVED) throw new BadRequestException('Already approved');
      se.status = SignatureStatus.APPROVED;
      se.signedAt = new Date().toISOString();
      const approvals = entity.signatures.filter(s => s.status === SignatureStatus.APPROVED).length;
      const reachedQuorum = approvals >= entity.threshold;
      if (reachedQuorum) entity.status = MultiSigTransactionStatus.APPROVED;
      await repo.save(entity);
      return { entity, expired: false, reachedQuorum };
    });

    if (outcome.expired) throw new BadRequestException('Transaction expired');

    if (outcome.reachedQuorum) {
      // The approval is committed. If enqueueing fails, the sweep task picks
      // the transaction up on its next run, so don't fail the request.
      try {
        await this.enqueueExecution(outcome.entity);
      } catch {
        this.logger.warn(`Tx ${outcome.entity.id} approved but not enqueued — the sweep will retry`);
      }
    }
    return this.toResponse(outcome.entity);
  }

  async rejectTransaction(transactionId: string, tenantId: string, signerId: string, reason?: string): Promise<MultiSigTransactionResponse> {
    const entity = await this.findPendingOrThrow(transactionId, tenantId);
    const se = entity.signatures?.find(s => s.signerId === signerId);
    if (!se) throw new ForbiddenException('Not authorised');
    se.status = SignatureStatus.REJECTED; se.signedAt = new Date().toISOString(); se.reason = reason;
    entity.status = MultiSigTransactionStatus.REJECTED; await this.repo.save(entity);
    return this.toResponse(entity);
  }

  async getTransactionStatus(transactionId: string, tenantId: string): Promise<MultiSigTransactionResponse> {
    const entity = await this.repo.findOne({ where: { id: transactionId, tenantId } });
    if (!entity) throw new NotFoundException('Transaction not found');
    return this.toResponse(entity);
  }

  async listPendingTransactions(tenantId: string): Promise<MultiSigTransactionResponse[]> {
    return (await this.repo.find({ where: { tenantId, status: MultiSigTransactionStatus.PENDING_SIGNATURES }, order: { createdAt: 'DESC' } })).map(e => this.toResponse(e));
  }

  async expireStaleTransactions(): Promise<number> {
    const r = await this.repo.update({ status: MultiSigTransactionStatus.PENDING_SIGNATURES, expiresAt: LessThan(new Date()) }, { status: MultiSigTransactionStatus.EXPIRED });
    return r.affected ?? 0;
  }

  /** Enqueue every APPROVED transaction that has no on-chain hash yet. Returns how many were enqueued. */
  async sweepApprovedTransactions(): Promise<number> {
    const txs = await this.repo.find({ where: { status: MultiSigTransactionStatus.APPROVED, stellarTxHash: IsNull() } });
    let count = 0;
    for (const tx of txs) {
      try {
        await this.enqueueExecution(tx);
        count++;
      } catch {
        // Already logged by enqueueExecution; the next sweep retries.
      }
    }
    return count;
  }

  /** Submit an APPROVED transaction's payment on-chain. Called by MultiSigExecutionProcessor. */
  async executeApprovedTransaction(transactionId: string): Promise<void> {
    const entity = await this.repo.findOne({ where: { id: transactionId } });
    if (!entity) throw new NotFoundException('Transaction not found');
    if (entity.status !== MultiSigTransactionStatus.APPROVED) {
      this.logger.warn(`Tx ${transactionId} not in APPROVED status, skipping`);
      return;
    }

    try {
      const hash = await this.paymentService.executePayment(entity, async (xdr) => {
        entity.xdr = xdr;
        await this.repo.update({ id: entity.id }, { xdr });
      });
      entity.stellarTxHash = hash;
      entity.status = MultiSigTransactionStatus.EXECUTED;
      entity.lastError = null;
      await this.repo.save(entity);
      this.logger.log(`Transaction ${entity.id} executed with hash ${hash}`);
    } catch (error) {
      entity.executionAttempts = (entity.executionAttempts ?? 0) + 1;
      entity.lastError = error.message;
      const maxAttempts = parseInt(
        this.config.get<string>('MULTI_SIG_MAX_EXECUTION_ATTEMPTS') || String(DEFAULT_MAX_EXECUTION_ATTEMPTS),
        10,
      );
      if (this.isRetryable(error) && entity.executionAttempts < maxAttempts) {
        // Stay APPROVED so the sweep task re-enqueues it.
        this.logger.warn(`Tx ${entity.id} failed with retryable error (attempt ${entity.executionAttempts}/${maxAttempts}): ${error.message}`);
        entity.status = MultiSigTransactionStatus.APPROVED;
      } else {
        entity.status = MultiSigTransactionStatus.EXECUTION_FAILED;
        this.logger.error(`Tx ${entity.id} failed terminally after ${entity.executionAttempts} attempt(s): ${error.message}`);
      }
      await this.repo.save(entity);
    }
  }

  private isRetryable(error: any): boolean {
    if (error instanceof StellarPaymentError) return error.retryable;
    const msg: string = error?.message || '';
    return !TERMINAL_ERROR_MARKERS.some((marker) => msg.includes(marker));
  }

  private async enqueueExecution(entity: MultiSigTransactionEntity): Promise<void> {
    try {
      await this.executionQueue.add(
        MULTI_SIG_EXECUTE_JOB,
        { transactionId: entity.id },
        {
          // A fixed jobId makes enqueueing idempotent: Bull ignores an add for a
          // job that is still waiting or active, so the sweep can't double-queue.
          jobId: `multi-sig-${entity.id}`,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to enqueue tx ${entity.id}: ${error.message}`);
      throw error;
    }
  }

  private async findPendingOrThrow(id: string, tenantId: string): Promise<MultiSigTransactionEntity> {
    const e = await this.repo.findOne({ where: { id, tenantId } });
    if (!e) throw new NotFoundException('Not found');
    if (e.status !== MultiSigTransactionStatus.PENDING_SIGNATURES) { throw new BadRequestException('Already ' + e.status); }
    return e;
  }

  private toResponse(e: MultiSigTransactionEntity): MultiSigTransactionResponse {
    return { id: e.id, tenantId: e.tenantId, destination: e.destination, amount: e.amount, asset: e.asset,
      status: e.status, threshold: e.threshold, totalSigners: e.totalSigners, signatures: e.signatures || [],
      stellarTxHash: e.stellarTxHash, expiresAt: e.expiresAt.toISOString(), createdAt: e.createdAt.toISOString(), memo: e.memo };
  }
}
