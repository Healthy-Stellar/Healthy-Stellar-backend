import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../entities/user.entity';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  mfaEnabled: boolean;
  sessionId: string;
  organizationId: string;
}

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
  ) {}

  /**
   * Generate JWT access token for authenticated user
   */
  generateAccessToken(user: User, sessionId: string, mfaVerified: boolean = false): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled && mfaVerified,
      sessionId,
      organizationId: user.organizationId ?? null,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Generate refresh token for session renewal.
   * Signed with REFRESH_TOKEN_SECRET so access and refresh tokens
   * cannot be substituted for each other.
   */
  generateRefreshToken(user: User, sessionId: string): string {
    const payload = {
      userId: user.id,
      sessionId,
      type: 'refresh',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: '7d',
      algorithm: 'HS512',
    });
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
   * Verify access token
   */
  verifyAccessToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
        algorithms: ['HS512'],
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): any {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
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
