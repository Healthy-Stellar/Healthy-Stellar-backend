import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SessionEntity } from '../entities/session.entity';
import { User } from '../entities/user.entity';
import { SessionRevocationService } from './session-revocation.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateSessionOptions {
  /**
   * Primary key to persist. Pass the same value that is embedded as
   * `sessionId` in the tokens issued for this session, so every later lookup
   * (JwtAuthGuard, refresh, logout) finds the row. Generated when omitted.
   */
  id?: string;
  /** Whether the session has already completed an MFA challenge. Defaults to false. */
  mfaVerified?: boolean;
}

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
   * Session ids are Postgres UUIDs. Anything else (e.g. the legacy 32-char
   * hex ids, or a forged claim) is rejected up front instead of being sent to
   * the database, where it would raise `invalid input syntax for type uuid`.
   */
  isWellFormedSessionId(sessionId: unknown): sessionId is string {
    return typeof sessionId === 'string' && UUID_RE.test(sessionId);
  }

  /** Generate a session id suitable for both the JWT claim and the primary key. */
  generateSessionId(): string {
    return randomUUID();
  }

  /**
   * Create a new session, enforcing the per-user session limit.
   * If the limit is reached, the oldest active session is revoked first.
   */
  async createSession(
    userId: string,
    accessToken: string,
    refreshToken: string | null,
    expiresAt: Date,
    refreshTokenExpiresAt: Date,
    ipAddress: string,
    userAgent: string,
    deviceId?: string,
    options: CreateSessionOptions = {},
  ): Promise<SessionEntity> {
    const id = options.id ?? this.generateSessionId();
    if (!this.isWellFormedSessionId(id)) {
      throw new Error('Session id must be a UUID');
    }

    await this.enforceSessionLimit(userId);

    const session = this.sessionRepository.create({
      id,
      userId,
      accessTokenHash: this.hashToken(accessToken),
      // No refresh token is issued for some sessions (e.g. MFA-pending logins).
      // The column is NOT NULL + UNIQUE, so store the hash of an unguessable
      // value that was never handed to anyone.
      refreshTokenHash: this.hashToken(refreshToken ?? randomBytes(32).toString('hex')),
      expiresAt,
      refreshTokenExpiresAt,
      ipAddress,
      userAgent,
      deviceId: deviceId || 'unknown',
      isActive: true,
      mfaVerified: options.mfaVerified === true,
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
    if (!this.isWellFormedSessionId(sessionId)) {
      return null;
    }

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
   * Load the session a refresh token belongs to and check it can still be
   * refreshed. Callers read `mfaVerified` from the returned row so a refresh
   * preserves the session's MFA state rather than re-deriving it.
   */
  async getRefreshableSession(sessionId: string, userId: string): Promise<SessionEntity> {
    const session = this.isWellFormedSessionId(sessionId)
      ? await this.sessionRepository.findOne({ where: { id: sessionId } })
      : null;

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Session not found');
    }

    if (!session.isActive) {
      throw new UnauthorizedException('Session is not active');
    }

    if (!session.refreshTokenExpiresAt || new Date() > session.refreshTokenExpiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    return session;
  }

  /**
   * Mark a session as MFA-verified after a successful TOTP / backup-code
   * challenge, rotating its token hashes to the newly issued pair.
   */
  async completeMfaChallenge(
    sessionId: string,
    userId: string,
    newAccessToken: string,
    newRefreshToken: string,
    newExpiresAt: Date,
    newRefreshTokenExpiresAt: Date,
  ): Promise<SessionEntity> {
    const session = this.isWellFormedSessionId(sessionId)
      ? await this.sessionRepository.findOne({ where: { id: sessionId } })
      : null;

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Session not found');
    }

    if (!session.isActive || new Date() > session.expiresAt) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    session.mfaVerified = true;
    session.accessTokenHash = this.hashToken(newAccessToken);
    session.refreshTokenHash = this.hashToken(newRefreshToken);
    session.expiresAt = newExpiresAt;
    session.refreshTokenExpiresAt = newRefreshTokenExpiresAt;

    return this.sessionRepository.save(session);
  }

  /**
   * Refresh session tokens.
   */
  async refreshSession(
    sessionId: string,
    newAccessToken: string,
    newRefreshToken: string | null,
    newExpiresAt: Date,
    newRefreshTokenExpiresAt: Date,
  ): Promise<SessionEntity> {
    const session = this.isWellFormedSessionId(sessionId)
      ? await this.sessionRepository.findOne({ where: { id: sessionId } })
      : null;

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (!session.isActive) {
      throw new UnauthorizedException('Session is not active');
    }

    if (new Date() > session.refreshTokenExpiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    session.accessTokenHash = this.hashToken(newAccessToken);
    session.refreshTokenHash = this.hashToken(
      newRefreshToken ?? randomBytes(32).toString('hex'),
    );
    session.expiresAt = newExpiresAt;
    session.refreshTokenExpiresAt = newRefreshTokenExpiresAt;

    return this.sessionRepository.save(session);
  }

  /**
   * Revoke session by ID.
   */
  async revokeSession(sessionId: string): Promise<void> {
    const session = this.isWellFormedSessionId(sessionId)
      ? await this.sessionRepository.findOne({ where: { id: sessionId } })
      : null;

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
   * Check if session is valid.
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    if (!this.isWellFormedSessionId(sessionId)) {
      return false;
    }

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
   */
  async enforceSessionTimeout(sessionId: string, inactivityMinutes: number = 15): Promise<boolean> {
    if (!this.isWellFormedSessionId(sessionId)) {
      return false;
    }

    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });

    if (!session) {
      return false;
    }

    const lastActivityTime = session.updatedAt;
    const now = new Date();
    const minutesSinceLastActivity = (now.getTime() - lastActivityTime.getTime()) / (1000 * 60);

    if (minutesSinceLastActivity > inactivityMinutes) {
      session.isActive = false;
      session.revokedAt = new Date();
      await this.sessionRepository.save(session);
      return false;
    }

    return true;
  }

  /**
   * Get session info for user.
   */
  async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
    if (!this.isWellFormedSessionId(sessionId)) {
      return null;
    }

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
   * Update session activity timestamp.
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    if (!this.isWellFormedSessionId(sessionId)) {
      return;
    }

    await this.sessionRepository.update({ id: sessionId }, { updatedAt: new Date() });
  }
}
