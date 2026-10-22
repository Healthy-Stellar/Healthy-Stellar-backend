import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKey, ApiKeyScope } from '../entities/api-key.entity';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  /**
   * Validates an API key by:
   *  1. Hashing the incoming raw key and looking it up.
   *  2. Checking isActive.
   *  3. Checking expiresAt — rejects keys whose expiry has passed.
   */
  async validateApiKey(rawKey: string): Promise<ApiKey> {
    const keyHash = this.hashKey(rawKey);

    const record = await this.apiKeyRepo.findOne({
      where: { keyHash, isActive: true },
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
   * Returns true if the given API key has at least one of the required scopes.
   */
  hasAnyScope(apiKey: ApiKey, requiredScopes: ApiKeyScope[]): boolean {
    return requiredScopes.some((scope) => apiKey.scopes?.includes(scope));
  }

  /**
   * Records the IP address that most recently used this API key.
   */
  async recordLastUsedIp(id: string, ip: string): Promise<void> {
    await this.apiKeyRepo.update(id, {
      lastUsedByIp: ip,
      lastUsedAt: new Date(),
    });
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
      .set({ isActive: false })
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
