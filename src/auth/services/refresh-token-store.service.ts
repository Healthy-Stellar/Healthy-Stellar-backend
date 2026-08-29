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
    const activeKey = this.activeKey(sessionId);
    const consumedKey = this.consumedKey(tokenHash);

    // Atomic Lua script to prevent race conditions
    const luaScript = `
      local consumed = redis.call('GET', KEYS[2])
      if consumed then
        redis.call('DEL', KEYS[1])
        return 1
      end
      local stored = redis.call('GET', KEYS[1])
      if not stored or stored ~= ARGV[1] then
        return 2
      end
      redis.call('DEL', KEYS[1])
      redis.call('SET', KEYS[2], '1', 'EX', ARGV[2])
      return 0
    `;

    const result = await client.eval(
      luaScript,
      2,
      activeKey,
      consumedKey,
      tokenHash,
      REFRESH_TTL_SECONDS,
    );

    if (result === 1) {
      throw new UnauthorizedException('Refresh token reuse detected — session revoked');
    }
    if (result === 2) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /** Remove the active refresh token for a session (logout / revoke). */
  async revokeSession(sessionId: string): Promise<void> {
    const client = await this.getClient();
    await client.del(this.activeKey(sessionId));
  }
}
