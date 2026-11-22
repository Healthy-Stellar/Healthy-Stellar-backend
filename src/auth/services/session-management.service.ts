import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SessionEntity } from '../entities/session.entity';
import { User } from '../entities/user.entity';
import { SessionRevocationService } from './session-revocation.service';

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
  private readonly activityThrottleMs: number;
  private readonly lastActivityUpdates = new Map<string, number>();

  constructor(
    @InjectRepository(SessionEntity)
    private sessionRepository: Repository<SessionEntity>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private sessionRevocationService: SessionRevocationService,
  ) {
    this.activityThrottleMs =
      this.configService?.get<number>('SESSION_ACTIVITY_THROTTLE_MS', 60_000) ?? 60_000;
  }

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
        this.lastActivityUpdates.delete(session.id);
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

    if (new Date() > session.refreshTokenExpiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const isTimeoutValid = await this.enforceSessionTimeout(session);
    if (!isTimeoutValid) {
      throw new UnauthorizedException('Session expired due to inactivity');
    }

    session.accessTokenHash = this.hashToken(newAccessToken);
    session.refreshTokenHash = this.hashToken(newRefreshToken);
    session.expiresAt = newExpiresAt;
    session.refreshTokenExpiresAt = newRefreshTokenExpiresAt;
    session.updatedAt = new Date();
    this.lastActivityUpdates.set(session.id, Date.now());

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
    this.lastActivityUpdates.delete(sessionId);

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
      this.lastActivityUpdates.delete(session.id);
    }

    await this.sessionRepository.save(sessions);

    // Propagate revocation to open WebSocket connections immediately.
    await this.sessionRevocationService.notifyUserSessionsRevoked(userId);
  }

  /**
   * Check if session is valid.
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
      session.revokedAt = new Date();
      await this.sessionRepository.save(session);
      this.lastActivityUpdates.delete(session.id);
      await this.sessionRevocationService.notifySessionRevoked(session.id);
      return false;
    }

    return this.enforceSessionTimeout(session);
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
   */
  async enforceSessionTimeout(
    sessionIdOrSession: string | SessionEntity,
    inactivityMinutes?: number,
  ): Promise<boolean> {
    const session =
      typeof sessionIdOrSession === 'string'
        ? await this.sessionRepository.findOne({ where: { id: sessionIdOrSession } })
        : sessionIdOrSession;

    if (!session || !session.isActive) {
      return false;
    }

    const timeout =
      inactivityMinutes ??
      this.configService?.get<number>('SESSION_TIMEOUT_MINUTES') ??
      this.configService?.get<number>('session_timeout_minutes') ??
      15;

    const lastActivity = session.updatedAt || session.createdAt || new Date();
    const lastActivityTime =
      lastActivity instanceof Date ? lastActivity.getTime() : new Date(lastActivity).getTime();
    const now = Date.now();
    const minutesSinceLastActivity = (now - lastActivityTime) / (1000 * 60);

    if (minutesSinceLastActivity > timeout) {
      session.isActive = false;
      session.revokedAt = new Date(now);
      await this.sessionRepository.save(session);
      this.lastActivityUpdates.delete(session.id);
      await this.sessionRevocationService?.notifySessionRevoked(session.id);
      return false;
    }

    return true;
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
   * Update session activity timestamp (throttled to avoid DB writes on every request).
   */
  async updateSessionActivity(sessionId: string, force: boolean = false): Promise<void> {
    const now = Date.now();
    const lastUpdate = this.lastActivityUpdates.get(sessionId);

    if (!force && lastUpdate && now - lastUpdate < this.activityThrottleMs) {
      return;
    }

    this.lastActivityUpdates.set(sessionId, now);
    await this.sessionRepository.update({ id: sessionId }, { updatedAt: new Date(now) });
  }
}
