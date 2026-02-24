import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SessionEntity } from '../entities/session.entity';
import { User } from '../entities/user.entity';

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
  ) {}

  /**
   * Create a new session
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
    const session = this.sessionRepository.create({
      userId,
      accessToken,
      refreshToken,
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
   * Get active session
   */
  async getSession(sessionId: string): Promise<SessionEntity | null> {
    return this.sessionRepository.findOne({
      where: {
        id: sessionId,
        isActive: true,
        expiresAt: LessThan(new Date()),
      },
    });
  }

  /**
   * Get all active sessions for user
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
   * Refresh session tokens
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

    session.accessToken = newAccessToken;
    session.refreshToken = newRefreshToken;
    session.expiresAt = newExpiresAt;
    session.refreshTokenExpiresAt = newRefreshTokenExpiresAt;

    return this.sessionRepository.save(session);
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    session.isActive = false;
    session.revokedAt = new Date();
    await this.sessionRepository.save(session);
  }

  /**
   * Revoke all sessions for user
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
  }

  /**
   * Check if session is valid
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

    return true;
  }

  /**
   * Clean up expired sessions (run periodically)
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
   * Enforce session timeout (HIPAA requirement: 15 minutes of inactivity)
   */
  async enforceSessionTimeout(sessionId: string, inactivityMinutes: number = 15): Promise<boolean> {
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
   * Get session info for user
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
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.sessionRepository.update({ id: sessionId }, { updatedAt: new Date() });
  }
}
