import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { SessionEntity } from '../entities/session.entity';

/**
 * Minimal API-key record shape expected by this service.
 * Replace with your actual ApiKey entity import once it exists.
 */
export interface ApiKeyRecord {
  id: string;
  keyHash: string;
  isActive: boolean;
  expiresAt: Date | null;
}

@Injectable()
export class ApiKeyService {
  constructor(
    /**
     * Swap SessionEntity for your real ApiKey entity/repository.
     * Kept as SessionEntity here so the module compiles without a new entity.
     */
    @InjectRepository(SessionEntity)
    private readonly apiKeyRepo: Repository<ApiKeyRecord>,
  ) {}

  /**
   * Validates an API key by:
   *  1. Hashing the incoming raw key and looking it up.
   *  2. Checking isActive.
   *  3. Checking expiresAt — rejects keys whose expiry has passed.
   */
  async validateApiKey(rawKey: string): Promise<ApiKeyRecord> {
    const keyHash = this.hashKey(rawKey);

    const record = await this.apiKeyRepo.findOne({
      where: { keyHash, isActive: true } as never,
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    if (record.expiresAt !== null && record.expiresAt <= new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    return record;
  }

  /**
   * Deactivates all keys whose expiresAt is in the past and isActive is still true.
   * Called by the expiry task on a schedule.
   * Returns the count of deactivated keys.
   */
  async deactivateExpiredKeys(): Promise<number> {
    const result = await this.apiKeyRepo
      .createQueryBuilder()
      .update()
      .set({ isActive: false } as never)
      .where('isActive = :active AND expiresAt IS NOT NULL AND expiresAt <= :now', {
        active: true,
        now: new Date(),
      })
      .execute();

    return result.affected ?? 0;
  }

  private hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }
}
