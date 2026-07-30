import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Publishes session-revocation events to Redis so that any subscriber
 * (e.g. GraphQL WebSocket connections) can react immediately.
 *
 * Channel conventions:
 *   session:revoked:{sessionId}   — single session revoked
 *   user:sessions:revoked:{userId} — all sessions for a user revoked
 */
@Injectable()
export class SessionRevocationService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionRevocationService.name);
  private readonly publisher: Redis;

  /** Channel prefix constants — shared with subscribers. */
  static readonly SESSION_REVOKED_CHANNEL = 'session:revoked';
  static readonly USER_SESSIONS_REVOKED_CHANNEL = 'user:sessions:revoked';

  constructor(private readonly configService: ConfigService) {
    this.publisher = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB', 0),
      lazyConnect: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.publisher.quit().catch(() => {});
  }

  /** Notify subscribers that a specific session has been revoked. */
  async notifySessionRevoked(sessionId: string): Promise<void> {
    try {
      await this.publisher.publish(
        `${SessionRevocationService.SESSION_REVOKED_CHANNEL}:${sessionId}`,
        sessionId,
      );
    } catch (err) {
      // Non-fatal: log and continue — the DB record is already invalidated.
      this.logger.error(`Failed to publish session revocation for ${sessionId}: ${err.message}`);
    }
  }

  /** Notify subscribers that all sessions for a user have been revoked. */
  async notifyUserSessionsRevoked(userId: string): Promise<void> {
    try {
      await this.publisher.publish(
        `${SessionRevocationService.USER_SESSIONS_REVOKED_CHANNEL}:${userId}`,
        userId,
      );
    } catch (err) {
      this.logger.error(`Failed to publish user session revocation for ${userId}: ${err.message}`);
    }
  }
}
