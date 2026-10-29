import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SessionEntity } from '../entities/session.entity';
import { User } from '../entities/user.entity';
import { SessionRevocationService } from './session-revocation.service';

/** HIPAA §164.312(a)(2)(iii): sessions must lock after at most 15 minutes of inactivity. */
export const DEFAULT_SESSION_INACTIVITY_TIMEOUT_MINUTES = 15;

/**
 * Session activity is coalesced into at most one write per session per minute so
 * that authenticated requests do not each issue a redundant `UPDATE`. Set
 * `SESSION_ACTIVITY_WRITE_THROTTLE_SECONDS=0` to disable coalescing.
 */
export const DEFAULT_SESSION_ACTIVITY_THROTTLE_SECONDS = 60;

/** Hard cap on the in-process activity-write cache so it cannot grow without bound. */
const MAX_ACTIVITY_CACHE_ENTRIES = 10_000;

export interface SessionInfo {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class SessionManagementService {
  private readonly logger = new Logger(SessionManagementService.name);

  /**
   * Last time this process issued an activity write per session. Purely an
   * optimisation: the write itself is still guarded by an `updatedAt` predicate,
   * so a stale/missing entry can never move the activity clock backwards.
   */
  private readonly activityWriteCache = new Map<string, number>();

  constructor(
    @InjectRepository(SessionEntity)
    private sessionRepository: Repository<SessionEntity>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private sessionRevocationService: SessionRevocationService,
  ) {}

  /** SHA-256 hash a token — the raw value is never persisted. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create a new session, enforcing the per-user session limit.
   * If the limit is reached, the oldest active session is revoked first.
   */
  async createSession(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
    refreshTokenExpiresAt: Date,
    ipAddress: string,
    userAgent: string,
    deviceId?: string,
  ): Promise<SessionEntity> {
    await this.enforceSessionLimit(userId);

    const session = this.sessionRepository.create({
      userId,
      accessTokenHash: this.hashToken(accessToken),
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt,
      refreshTokenExpiresAt,
      ipAddress,
      userAgent,
      deviceId: deviceId || 'unknown',
      isActive: true,
    });

    return this.sessionRepository.save(session);
  }

  /**
   * Revoke the oldest active sessions when the per-user limit is reached.
   */
  private async enforceSessionLimit(userId: string): Promise<void> {
    const maxSessions = this.configService.get<number>('MAX_SESSIONS_PER_USER', 5);

    const activeSessions = await this.sessionRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'ASC' },
    });

    if (activeSessions.length >= maxSessions) {
      const excess = activeSessions.length - maxSessions + 1;
      const toRevoke = activeSessions.slice(0, excess);
      const now = new Date();
      for (const session of toRevoke) {
        session.isActive = false;
        session.revokedAt = now;
      }
      await this.sessionRepository.save(toRevoke);
    }
  }

  /**
   * Get active, non-expired session by ID.
   */
  async getSession(sessionId: string): Promise<SessionEntity | null> {
    return this.sessionRepository.findOne({
      where: {
        id: sessionId,
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  /**
   * Get all active sessions for user.
   */
  async getUserSessions(userId: string): Promise<SessionEntity[]> {
    return this.sessionRepository.find({
      where: {
        userId,
        isActive: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Refresh session tokens.
   */
  async refreshSession(
    sessionId: string,
    newAccessToken: string,
    newRefreshToken: string,
    newExpiresAt: Date,
    newRefreshTokenExpiresAt: Date,
  ): Promise<SessionEntity> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (!session.isActive) {
      throw new UnauthorizedException('Session is not active');
    }

    // A long-lived refresh token must not resurrect a session that already
    // exceeded the HIPAA inactivity window.
    if (this.isIdle(session, this.getInactivityTimeoutMinutes())) {
      await this.revokeForInactivity(session);
      throw new UnauthorizedException('Session expired due to inactivity');
    }

    if (new Date() > session.refreshTokenExpiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    session.accessTokenHash = this.hashToken(newAccessToken);
    session.refreshTokenHash = this.hashToken(newRefreshToken);
    session.expiresAt = newExpiresAt;
    session.refreshTokenExpiresAt = newRefreshTokenExpiresAt;

    return this.sessionRepository.save(session);
  }

  /**
   * Revoke session by ID.
   */
  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    session.isActive = false;
    session.revokedAt = new Date();
    await this.sessionRepository.save(session);

    // Propagate revocation to open WebSocket connections immediately.
    await this.sessionRevocationService.notifySessionRevoked(sessionId);
  }

  /**
   * Revoke all sessions for user.
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.sessionRepository.find({
      where: {
        userId,
        isActive: true,
      },
    });

    for (const session of sessions) {
      session.isActive = false;
      session.revokedAt = new Date();
    }

    await this.sessionRepository.save(sessions);

    // Propagate revocation to open WebSocket connections immediately.
    await this.sessionRevocationService.notifyUserSessionsRevoked(userId);
  }

  /**
   * Check if session is valid — including the inactivity timeout.
   *
   * A session that has been idle for longer than
   * `SESSION_INACTIVITY_TIMEOUT_MINUTES` (default 15, HIPAA) is revoked here so
   * every caller (HTTP guards, GraphQL, WebSocket) rejects it and it can never
   * be revived by a refresh.
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });

    if (!session) {
      return false;
    }

    if (!session.isActive) {
      return false;
    }

    if (new Date() > session.expiresAt) {
      session.isActive = false;
      await this.sessionRepository.save(session);
      return false;
    }

    if (this.isIdle(session, this.getInactivityTimeoutMinutes())) {
      await this.revokeForInactivity(session);
      return false;
    }

    return true;
  }

  /**
   * Mark all currently-active but expired sessions as inactive.
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.sessionRepository
      .createQueryBuilder()
      .update(SessionEntity)
      .set({ isActive: false, revokedAt: new Date() })
      .where('expiresAt < :now AND isActive = :active', { now: new Date(), active: true })
      .execute();

    return result.affected || 0;
  }

  /**
   * Hard-delete sessions whose expiresAt is older than 30 days.
   * Called by the scheduled cleanup job.
   */
  async deleteOldExpiredSessions(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.sessionRepository.delete({
      isActive: false,
      expiresAt: LessThan(thirtyDaysAgo),
    });
    return result.affected || 0;
  }

  /**
   * Enforce session timeout (HIPAA requirement: 15 minutes of inactivity).
   *
   * The window defaults to `SESSION_INACTIVITY_TIMEOUT_MINUTES`; pass
   * `inactivityMinutes` to override it for a specific check.
   */
  async enforceSessionTimeout(sessionId: string, inactivityMinutes?: number): Promise<boolean> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });

    if (!session) {
      return false;
    }

    if (!session.isActive) {
      return false;
    }

    if (this.isIdle(session, this.getInactivityTimeoutMinutes(inactivityMinutes))) {
      await this.revokeForInactivity(session);
      return false;
    }

    return true;
  }

  /** Resolve the inactivity window, tolerating strings from env and bad values. */
  private getInactivityTimeoutMinutes(overrideMinutes?: number): number {
    const configured = Number(
      overrideMinutes ??
        this.configService.get<string | number>(
          'SESSION_INACTIVITY_TIMEOUT_MINUTES',
          DEFAULT_SESSION_INACTIVITY_TIMEOUT_MINUTES,
        ),
    );

    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_SESSION_INACTIVITY_TIMEOUT_MINUTES;
  }

  /** Resolve the activity-write throttle window (0 disables throttling). */
  private getActivityThrottleSeconds(): number {
    const configured = Number(
      this.configService.get<string | number>(
        'SESSION_ACTIVITY_WRITE_THROTTLE_SECONDS',
        DEFAULT_SESSION_ACTIVITY_THROTTLE_SECONDS,
      ),
    );

    return Number.isFinite(configured) && configured >= 0
      ? configured
      : DEFAULT_SESSION_ACTIVITY_THROTTLE_SECONDS;
  }

  /**
   * True when the session has gone longer than the allowed window without
   * activity. `updatedAt` is the activity clock maintained by
   * `updateSessionActivity()`; `createdAt` covers rows written before it existed.
   */
  private isIdle(session: SessionEntity, inactivityMinutes: number): boolean {
    const lastActivity = session.updatedAt ?? session.createdAt;

    if (!lastActivity) {
      return false;
    }

    const idleMs = Date.now() - new Date(lastActivity).getTime();
    return idleMs > inactivityMinutes * 60 * 1000;
  }

  /** Revoke a session that exceeded the inactivity window and drop its sockets. */
  private async revokeForInactivity(session: SessionEntity): Promise<void> {
    session.isActive = false;
    session.revokedAt = new Date();
    await this.sessionRepository.save(session);
    this.activityWriteCache.delete(session.id);

    // The session is already revoked in the database; a failing socket
    // notification must not turn the rejection into a server error.
    try {
      await this.sessionRevocationService.notifySessionRevoked(session.id);
    } catch (error) {
      this.logger.warn(
        `Failed to notify revocation of idle session ${session.id}: ${(error as Error)?.message}`,
      );
    }
  }

  /**
   * Get session info for user.
   */
  async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceId: session.deviceId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Record session activity, coalescing writes to at most one per throttle
   * window (default 60s) per session.
   *
   * Two layers keep this cheap without ever letting the clock drift:
   *   1. An in-process cache skips the round trip entirely for requests that
   *      arrive inside the throttle window.
   *   2. The `UPDATE` carries an `updatedAt < now - window` predicate, so a
   *      cold/stale cache (or another instance writing concurrently) cannot
   *      move the activity clock backwards.
   *
   * Activity tracking is best-effort: a failure here must never reject an
   * otherwise valid request. Activity is also stamped by every successful
   * `refreshSession()`.
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    const throttleMs = this.getActivityThrottleSeconds() * 1000;
    const now = Date.now();

    if (throttleMs > 0) {
      const lastWrite = this.activityWriteCache.get(sessionId);

      if (lastWrite !== undefined && now - lastWrite < throttleMs) {
        return;
      }

      this.rememberActivityWrite(sessionId, now, throttleMs);
    }

    try {
      await this.sessionRepository.update(
        throttleMs > 0
          ? { id: sessionId, updatedAt: LessThan(new Date(now - throttleMs)) }
          : { id: sessionId },
        { updatedAt: new Date(now) },
      );
    } catch (error) {
      // Do not leave a cache entry behind for a write that never landed.
      this.activityWriteCache.delete(sessionId);
      this.logger.warn(
        `Failed to record activity for session ${sessionId}: ${(error as Error)?.message}`,
      );
    }
  }

  /** Store a cache entry, pruning expired entries when the cache is full. */
  private rememberActivityWrite(sessionId: string, now: number, throttleMs: number): void {
    if (this.activityWriteCache.size >= MAX_ACTIVITY_CACHE_ENTRIES) {
      const cutoff = now - throttleMs;

      for (const [key, writtenAt] of this.activityWriteCache) {
        if (writtenAt <= cutoff) {
          this.activityWriteCache.delete(key);
        }
      }

      if (this.activityWriteCache.size >= MAX_ACTIVITY_CACHE_ENTRIES) {
        const oldestKey = this.activityWriteCache.keys().next().value;
        if (oldestKey !== undefined) {
          this.activityWriteCache.delete(oldestKey);
        }
      }
    }

    this.activityWriteCache.set(sessionId, now);
  }
}
