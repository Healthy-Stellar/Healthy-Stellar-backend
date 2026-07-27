import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MultiSigTransactionEntity } from "../entities/multi-sig-transaction.entity";
import { MultiSigTransactionStatus, SignatureStatus, CreateMultiSigPaymentDto, ApproveRejectDto, MultiSigTransactionResponse } from "../interfaces/multi-sig.interface";
import { StellarService } from "./stellar.service";
import { NotificationsGateway } from "../../notifications/notifications.gateway";
const THRESHOLD="10000",Q=2,TOTAL=3,TTL=60;

@Injectable()
export class MultiSigTransactionService {
  private readonly logger = new Logger(MultiSigTransactionService.name);
  constructor(
    @InjectRepository(MultiSigTransactionEntity)
    private readonly repo: Repository<MultiSigTransactionEntity>,
    private readonly config: ConfigService,
    private readonly stellarService: StellarService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createMultiSigPayment(dto: CreateMultiSigPaymentDto, requesterId: string): Promise<MultiSigTransactionResponse> {
    const thresholdAmount = this.config.get<string>('MULTI_SIG_THRESHOLD_' + dto.tenantId, THRESHOLD);
    if (BigInt(dto.amount) < BigInt(thresholdAmount)) throw new BadRequestException('Amount below threshold');
    const quorumSize = parseInt(this.config.get<string>('MULTI_SIG_QUORUM_' + dto.tenantId) || String(Q), 10);
    const signers = (this.config.get<string>('MULTI_SIG_SIGNERS_' + dto.tenantId, '') || '').split(',').filter(Boolean).map(s => s.trim());
    const ttlMinutes = parseInt(this.config.get<string>('MULTI_SIG_TTL_MINUTES_' + dto.tenantId) || String(TTL), 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60000);
    const entity = this.repo.create({
      tenantId: dto.tenantId, destination: dto.destination, amount: dto.amount,
      asset: dto.asset || 'XLM', status: MultiSigTransactionStatus.PENDING_SIGNATURES,
      threshold: quorumSize, totalSigners: signers.length || TOTAL, ttlMinutes, expiresAt,
      requesterId, signatures: signers.map(s => ({ signerId: s, status: SignatureStatus.PENDING })), memo: dto.memo,
    });
    const saved = await this.repo.save(entity);
    signers.forEach(s => this.notificationsGateway.emitNotification({
      eventType: 'multi-sig.payment.awaiting', resourceId: s,
      metadata: { transactionId: saved.id, amount: dto.amount, asset: saved.asset, destination: dto.destination },
    }));
    return this.toResponse(saved);
  }

  async approveTransaction(transactionId: string, dto: ApproveRejectDto): Promise<MultiSigTransactionResponse> {
    const entity = await this.findPendingOrThrow(transactionId);
    if (new Date() > entity.expiresAt) { entity.status = MultiSigTransactionStatus.EXPIRED; await this.repo.save(entity); throw new BadRequestException('Transaction expired'); }
    const se = entity.signatures?.find(s => s.signerId === dto.signerId);
    if (!se) throw new BadRequestException('Not authorised');
    if (se.status === SignatureStatus.REJECTED) throw new BadRequestException('Already rejected');
    if (se.status === SignatureStatus.APPROVED) throw new BadRequestException('Already approved');
    se.status = SignatureStatus.APPROVED; se.signedAt = new Date().toISOString();
    const approvals = entity.signatures!.filter(s => s.status === SignatureStatus.APPROVED).length;
    if (approvals >= entity.threshold) { entity.status = MultiSigTransactionStatus.APPROVED; await this.repo.save(entity); }
    else { await this.repo.save(entity); }
    return this.toResponse(entity);
  }

  async rejectTransaction(transactionId: string, dto: ApproveRejectDto): Promise<MultiSigTransactionResponse> {
    const entity = await this.findPendingOrThrow(transactionId);
    const se = entity.signatures?.find(s => s.signerId === dto.signerId);
    if (!se) throw new BadRequestException('Not authorised');
    se.status = SignatureStatus.REJECTED; se.signedAt = new Date().toISOString(); se.reason = dto.reason;
    entity.status = MultiSigTransactionStatus.REJECTED; await this.repo.save(entity);
    return this.toResponse(entity);
  }

  async getTransactionStatus(transactionId: string): Promise<MultiSigTransactionResponse> {
    const entity = await this.repo.findOne({ where: { id: transactionId } });
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

  private async findPendingOrThrow(id: string): Promise<MultiSigTransactionEntity> {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Not found');
    if (e.status !== MultiSigTransactionStatus.PENDING_SIGNATURES) throw new BadRequestException('Already ' + e.status);
    return e;
  }

  private toResponse(e: MultiSigTransactionEntity): MultiSigTransactionResponse {
    return { id: e.id, tenantId: e.tenantId, destination: e.destination, amount: e.amount, asset: e.asset,
      status: e.status, threshold: e.threshold, totalSigners: e.totalSigners, signatures: e.signatures || [],
      stellarTxHash: e.stellarTxHash, expiresAt: e.expiresAt.toISOString(), createdAt: e.createdAt.toISOString(), memo: e.memo };
  }
}
