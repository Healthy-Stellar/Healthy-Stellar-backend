import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../entities/user.entity';
import { SecretRotationService } from './secret-rotation.service';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  /**
   * Session-scoped: true only when the session this token belongs to has
   * passed a TOTP / backup-code challenge. Deliberately not named after the
   * account-level `User.mfaEnabled` flag, which says nothing about whether
   * MFA was performed for this login.
   */
  mfaVerified: boolean;
  /**
   * Set on the short-lived token issued after a password-only login for an
   * MFA-enabled account. Such a token is rejected everywhere except routes
   * marked `@AllowMfaPending()` (the MFA challenge endpoints).
   */
  mfaPending?: boolean;
  sessionId: string;
  organizationId: string;
}

export interface VerifyAccessTokenOptions {
  /** Accept an MFA-pending token. Only the MFA challenge endpoints should set this. */
  allowMfaPending?: boolean;
}

/** Lifetime of the MFA-pending token returned by POST /auth/login. */
export const MFA_PENDING_TOKEN_TTL_SECONDS = 5 * 60;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

@Injectable()
export class AuthTokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private secretRotation: SecretRotationService,
  ) {}

  /**
   * Generate JWT access token for authenticated user
   */
  generateAccessToken(user: User, sessionId: string, mfaVerified: boolean = false): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      mfaVerified: mfaVerified === true,
      sessionId,
      organizationId: user.organizationId ?? null,
    };

    return this.secretRotation.sign(payload, { algorithm: 'HS512' });
  }

  /**
   * Short-lived token proving only that the password step succeeded. It can be
   * exchanged for a full token pair at POST /auth/mfa/verify-code and is
   * refused by every other route.
   */
  generateMfaPendingToken(user: User, sessionId: string): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      mfaVerified: false,
      mfaPending: true,
      sessionId,
      organizationId: user.organizationId ?? null,
    };

    return this.secretRotation.sign(payload, {
      algorithm: 'HS512',
      expiresIn: MFA_PENDING_TOKEN_TTL_SECONDS,
    });
  }

  /**
   * Generate refresh token for session renewal.
   * Signed with JWT_REFRESH_SECRET so access and refresh tokens
   * cannot be substituted for each other.
   */
  generateRefreshToken(user: User, sessionId: string): string {
    const payload = {
      userId: user.id,
      sessionId,
      type: 'refresh',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
      algorithm: 'HS512',
    }); // refresh tokens use a separate static secret — not subject to JWT_SECRET rotation
  }

  /**
   * Generate tokens for completed authentication
   */
  generateTokenPair(user: User, sessionId: string, mfaVerified: boolean = false): TokenPair {
    const accessToken = this.generateAccessToken(user, sessionId, mfaVerified);
    const refreshToken = this.generateRefreshToken(user, sessionId);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      refreshExpiresIn: 604800, // 7 days in seconds
    };
  }

  /**
   * Verify access token. MFA-pending tokens are rejected unless the caller
   * explicitly opts in.
   */
  verifyAccessToken(token: string, options: VerifyAccessTokenOptions = {}): JwtPayload | null {
    const payload = this.secretRotation.verify<JwtPayload>(token, { algorithms: ['HS512'] });
    if (!payload) {
      return null;
    }

    if (payload.mfaPending && !options.allowMfaPending) {
      return null;
    }

    return payload;
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): any {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        algorithms: ['HS512'],
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Decode token without verification
   */
  decodeToken(token: string): any {
    return this.jwtService.decode(token);
  }
}
