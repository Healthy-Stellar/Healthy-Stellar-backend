import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ImportFingerprint, FingerprintStatus } from '../entities/import-fingerprint.entity';
import { ParsedRecord } from '../parsers/parsed-record.interface';

export interface DeduplicationResult {
  fingerprint: string;
  isDuplicate: boolean;
  isQuarantined: boolean;
}

@Injectable()
export class DeduplicationService {
  constructor(
    @InjectRepository(ImportFingerprint)
    private readonly repo: Repository<ImportFingerprint>,
  ) {}

  /**
   * Deterministic fingerprint: SHA-256 of (sourceSystemId|recordType|recordDate).
   * Falls back to a hash of the full rawPayload when fields are missing.
   */
  computeFingerprint(record: ParsedRecord): string {
    const parts = [
      record.sourceSystemId ?? record.rawPayload.slice(0, 64),
      record.recordType,
      record.recordDate ?? '',
    ].join('|');
    return crypto.createHash('sha256').update(parts).digest('hex');
  }

  /**
   * Check whether the fingerprint already exists.
   * Returns { isDuplicate: true } if found, false otherwise.
   */
  async check(fingerprint: string): Promise<DeduplicationResult> {
    const existing = await this.repo.findOne({ where: { fingerprint } });
    if (!existing) {
      return { fingerprint, isDuplicate: false, isQuarantined: false };
    }
    const isQuarantined = existing.status === FingerprintStatus.QUARANTINED;
    return { fingerprint, isDuplicate: true, isQuarantined };
  }

  /** Register a successfully imported fingerprint. */
  async register(fingerprint: string, jobId: string, sourceRow: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(ImportFingerprint)
      .values({ fingerprint, jobId, sourceRow: sourceRow.slice(0, 2000), status: FingerprintStatus.IMPORTED })
      .orIgnore()
      .execute();
  }

  /** Quarantine a suspected duplicate for human review. */
  async quarantine(fingerprint: string, jobId: string, sourceRow: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(ImportFingerprint)
      .values({ fingerprint, jobId, sourceRow: sourceRow.slice(0, 2000), status: FingerprintStatus.QUARANTINED })
      .orIgnore()
      .execute();
  }
}
