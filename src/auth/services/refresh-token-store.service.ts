import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class RefreshTokenStoreService {
  private redis: any;

  constructor(private configService: ConfigService) {}

  private async getClient() {
    if (!this.redis) {
      const Redis = require('ioredis');
      this.redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD'),
        db: this.configService.get<number>('REDIS_DB', 0),
        lazyConnect: true,
      });
      await this.redis.connect().catch(() => {});
    }
    return this.redis;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private activeKey(sessionId: string): string {
    return `rt:active:${sessionId}`;
  }

  private consumedKey(tokenHash: string): string {
    return `rt:consumed:${tokenHash}`;
  }

  /** Persist a new refresh token for a session, replacing any previous one. */
  async store(sessionId: string, token: string): Promise<void> {
    const client = await this.getClient();
    const tokenHash = this.hash(token);
    await client.set(this.activeKey(sessionId), tokenHash, 'EX', REFRESH_TTL_SECONDS);
  }

  /**
   * Validate and rotate a refresh token.
   * - Throws if the token was already consumed (reuse attack).
   * - Throws if the token doesn't match the stored hash for the session.
   * - Marks the old token as consumed and removes the active entry.
   */
  async consumeAndValidate(sessionId: string, token: string): Promise<void> {
    const client = await this.getClient();
    const tokenHash = this.hash(token);

    // Reuse attack: token was already rotated away but is being replayed
    const consumed = await client.get(this.consumedKey(tokenHash));
    if (consumed) {
      // Revoke the entire session — token theft assumed
      await this.revokeSession(sessionId);
      throw new UnauthorizedException('Refresh token reuse detected — session revoked');
    }

    const storedHash = await client.get(this.activeKey(sessionId));
    if (!storedHash || storedHash !== tokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Atomically: remove active entry, mark old hash as consumed for the TTL window
    await client.del(this.activeKey(sessionId));
    await client.set(this.consumedKey(tokenHash), '1', 'EX', REFRESH_TTL_SECONDS);
  }

  /** Remove the active refresh token for a session (logout / revoke). */
  async revokeSession(sessionId: string): Promise<void> {
    const client = await this.getClient();
    await client.del(this.activeKey(sessionId));
  }
}
