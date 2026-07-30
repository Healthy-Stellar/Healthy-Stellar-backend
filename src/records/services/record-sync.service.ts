import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Record } from '../entities/record.entity';

/** Shape of the record_deleted event emitted by the on-chain indexer */
export interface RecordDeletedEvent {
  /** The off-chain record UUID (mapped from the on-chain record ID) */
  recordId: string;
  /** Stellar transaction hash of the deletion transaction */
  txHash: string;
  /** Ledger timestamp of the deletion */
  deletedAt: Date;
}

export const RECORD_DELETED_EVENT = 'chain.record_deleted';

/**
 * RecordSyncService
 *
 * Listens for `chain.record_deleted` events emitted by the Soroban event
 * indexer and mirrors the deletion status to the off-chain `records` table
 * by setting `isDeleted = true` and recording the on-chain timestamp.
 *
 * The service is intentionally decoupled from the indexer via NestJS
 * EventEmitter2 so it can be tested in isolation and swapped for a
 * queue-based consumer (BullMQ, Kafka) without changing this class.
 */
@Injectable()
export class RecordSyncService implements OnModuleInit {
  private readonly logger = new Logger(RecordSyncService.name);

  constructor(
    @InjectRepository(Record)
    private readonly recordRepo: Repository<Record>,
  ) {}

  onModuleInit() {
    this.logger.log('RecordSyncService ready — listening for chain.record_deleted events');
  }

  /**
   * Handle a record_deleted event from the on-chain indexer.
   * Idempotent: calling it multiple times for the same recordId is safe.
   */
  @OnEvent(RECORD_DELETED_EVENT, { async: true })
  async handleRecordDeleted(event: RecordDeletedEvent): Promise<void> {
    const { recordId, txHash, deletedAt } = event;

    this.logger.log(
      `[handleRecordDeleted] recordId=${recordId} txHash=${txHash} deletedAt=${deletedAt.toISOString()}`,
    );

    const record = await this.recordRepo.findOne({ where: { id: recordId } });

    if (!record) {
      this.logger.warn(`[handleRecordDeleted] record ${recordId} not found in DB — skipping`);
      return;
    }

    if (record.isDeleted) {
      this.logger.debug(`[handleRecordDeleted] record ${recordId} already marked deleted — idempotent skip`);
      return;
    }

    await this.recordRepo.update(recordId, {
      isDeleted: true,
      deletedOnChainAt: deletedAt,
    });

    this.logger.log(`[handleRecordDeleted] record ${recordId} marked as deleted in DB`);
  }

  /**
   * Manually trigger a sync for a specific record (e.g. admin backfill).
   * Returns true if the record was updated, false if already deleted or not found.
   */
  async markDeleted(recordId: string, deletedAt: Date = new Date()): Promise<boolean> {
    const record = await this.recordRepo.findOne({ where: { id: recordId } });

    if (!record || record.isDeleted) return false;

    await this.recordRepo.update(recordId, {
      isDeleted: true,
      deletedOnChainAt: deletedAt,
    });

    this.logger.log(`[markDeleted] record ${recordId} manually marked as deleted`);
    return true;
  }
}
