import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as StellarSdk from '@stellar/stellar-sdk';
import { AuditLogEntity } from './audit-log.entity';
import { StellarService } from '../../stellar/services/stellar.service';
import { VerifyChainResult, AnchorRecord } from './interfaces/audit-chain.interface';
import { SubmitTransactionResult } from '../../stellar/interfaces/stellar-contract.interface';

const AUDIT_ANCHOR_KEY = 'audit_root';
const ANCHOR_INTERVAL_ENTRIES = 1000;
const ANCHOR_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuditChainService {
  private readonly logger = new Logger(AuditChainService.name);
  private lastAnchorTime = Date.now();
  private lastAnchoredId: string | null = null;

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
    private readonly stellarService: StellarService,
    private readonly configService: ConfigService,
  ) {}

  computeEntryHash(previousHash: string | null, entryData: Record<string, any>): string {
    const hashInput = (previousHash ?? '') + JSON.stringify(entryData, Object.keys(entryData).sort());
    return crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex');
  }

  getEntryData(entry: AuditLogEntity): Record<string, any> {
    return {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      description: entry.description,
      details: entry.details,
      severity: entry.severity,
      userAgent: entry.userAgent,
      timestamp: entry.timestamp?.toISOString(),
      ipAddress: entry.ipAddress,
      resourceId: entry.resourceId,
      resourceType: entry.resourceType,
      stellarTxHash: entry.stellarTxHash,
      requiresInvestigation: entry.requiresInvestigation,
      reviewed: entry.reviewed,
      reviewedBy: entry.reviewedBy,
      reviewedAt: entry.reviewedAt?.toISOString(),
    };
  }

  async verifyChain(fromId: string, toId: string): Promise<VerifyChainResult> {
    const fromEntry = await this.auditLogRepository.findOne({ where: { id: fromId } });
    const toEntry = await this.auditLogRepository.findOne({ where: { id: toId } });

    if (!fromEntry || !toEntry) {
      return { valid: false, fromId, toId, totalEntries: 0, error: 'Boundary entries not found' };
    }

    const entries = await this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.createdAt >= :fromDate', { fromDate: fromEntry.createdAt })
      .andWhere('audit.createdAt <= :toDate', { toDate: toEntry.createdAt })
      .orderBy('audit.createdAt', 'ASC')
      .getMany();

    if (entries.length === 0) {
      return { valid: false, fromId, toId, totalEntries: 0, error: 'No entries found in range' };
    }

    let previousHash: string | null = null;
    for (const entry of entries) {
      const entryData = this.getEntryData(entry);
      const computedHash = this.computeEntryHash(previousHash, entryData);

      if (entry.entryHash !== computedHash) {
        return {
          valid: false, fromId, toId, totalEntries: entries.length,
          error: `Hash mismatch at entry ${entry.id}: expected ${computedHash}, stored ${entry.entryHash}`,
          stellarTxId: toEntry.stellarTxHash ?? undefined,
        };
      }

      if (entry.previousHash !== previousHash) {
        return {
          valid: false, fromId, toId, totalEntries: entries.length,
          error: `Previous hash mismatch at entry ${entry.id}: expected ${previousHash}, stored ${entry.previousHash}`,
          stellarTxId: toEntry.stellarTxHash ?? undefined,
        };
      }

      previousHash = entry.entryHash;
    }

    return {
      valid: true, fromId, toId, totalEntries: entries.length,
      stellarTxId: toEntry.stellarTxHash ?? undefined,
    };
  }
  async getLastAnchorHash(): Promise<string | null> {
    const lastAnchored = await this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.stellarTxHash IS NOT NULL')
      .orderBy('audit.createdAt', 'DESC')
      .getOne();
    return lastAnchored?.entryHash ?? null;
  }

  async anchorToStellar(rootHash: string): Promise<AnchorRecord> {
    this.logger.log(`Anchoring root hash to Stellar: ${rootHash}`);
    try {
      const sourceSecret = this.configService.get<string>('STELLAR_SECRET_KEY');
      if (!sourceSecret) throw new Error('STELLAR_SECRET_KEY is not configured');
      const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret);
      const sourcePublicKey = sourceKeypair.publicKey();
      const accountInfo = await this.stellarService.getAccount(sourcePublicKey);
      const txBuilder = new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(sourcePublicKey, accountInfo.sequence),
        {
          fee: '100',
          networkPassphrase: this.configService.get<string>('STELLAR_NETWORK_PASSPHRASE', StellarSdk.Networks.TESTNET),
        },
      );
      txBuilder.addOperation(StellarSdk.Operation.manageData({ name: AUDIT_ANCHOR_KEY, value: rootHash }));
      txBuilder.setTimeout(30);
      const transaction = txBuilder.build();
      const xdr = transaction.toXDR();
      const result: SubmitTransactionResult = await this.stellarService.submitTransaction(xdr);
      const anchor: AnchorRecord = { rootHash, txHash: result.txHash, anchoredAt: new Date(), entryCount: 0 };
      this.logger.log(`Anchored root hash to Stellar: txHash=${result.txHash}, ledger=${result.ledger}`);
      return anchor;
    } catch (error: any) {
      this.logger.error(`Failed to anchor root hash: ${error.message}`, error.stack);
      throw error;
    }
  }

  async checkAndAnchor(): Promise<AnchorRecord | null> {
    try {
      let entryCountSinceAnchor = 0;
      if (this.lastAnchoredId) {
        const lastEntry = await this.auditLogRepository.findOne({ where: { id: this.lastAnchoredId } });
        if (lastEntry) {
          entryCountSinceAnchor = await this.auditLogRepository
            .createQueryBuilder('audit')
            .where('audit.createdAt > :t', { t: lastEntry.createdAt })
            .getCount();
        }
      } else {
        entryCountSinceAnchor = await this.auditLogRepository.count();
      }
      const timeSinceLastAnchor = Date.now() - this.lastAnchorTime;
      if (entryCountSinceAnchor < ANCHOR_INTERVAL_ENTRIES && timeSinceLastAnchor < ANCHOR_INTERVAL_MS) {
        return null;
      }
      const latestEntry = await this.auditLogRepository
        .createQueryBuilder('audit')
        .where('audit.entryHash IS NOT NULL')
        .orderBy('audit.createdAt', 'DESC')
        .getOne();
      if (!latestEntry?.entryHash) {
        this.logger.warn('No entry hash available to anchor');
        return null;
      }
      const anchor = await this.anchorToStellar(latestEntry.entryHash);
      latestEntry.stellarTxHash = anchor.txHash;
      await this.auditLogRepository.save(latestEntry);
      this.lastAnchorTime = Date.now();
      this.lastAnchoredId = latestEntry.id;
      return anchor;
    } catch (error: any) {
      this.logger.error(`checkAndAnchor failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getEntriesSinceAnchor(): Promise<number> {
    if (this.lastAnchoredId) {
      const lastEntry = await this.auditLogRepository.findOne({ where: { id: this.lastAnchoredId } });
      if (lastEntry) {
        return this.auditLogRepository
          .createQueryBuilder('audit')
          .where('audit.createdAt > :t', { t: lastEntry.createdAt })
          .getCount();
      }
    }
    return this.auditLogRepository.count();
  }
}