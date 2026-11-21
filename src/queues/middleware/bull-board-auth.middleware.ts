import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthTokenService, JwtPayload } from '../../auth/services/auth-token.service';
import { SessionManagementService } from '../../auth/services/session-management.service';
import { UserRole } from '../../auth/entities/user.entity';

/**
 * Bull Board Admin Authentication Middleware
 *
 * Protects the Bull Board dashboard at /admin/queues
 *
 * Security requirements:
 *  1. Requires SUPER_ADMIN role (not org-level ADMIN)
 *  2. Verifies access token with SecretRotationService (supports rotated secrets)
 *  3. Validates session is still active (checks revocation)
 *  4. Enforces read-only mode in production
 *
 * This prevents cross-tenant PHI exposure and job tampering.
 */
@Injectable()
export class BullBoardAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(BullBoardAuthMiddleware.name);
  private readonly isProduction = this.configService.get<string>('NODE_ENV') === 'production';

  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly sessionManagementService: SessionManagementService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = this.extractTokenFromHeader(req);

    if (!token) {
      this.logger.warn(
        `Unauthorized access attempt to Bull Board - No token provided. IP: ${this.getClientIp(req)}`,
      );
      throw new UnauthorizedException(
        'Authentication token required to access Bull Board dashboard',
      );
    }

    try {
      // Verify access token with SecretRotationService
      // This respects JWT_SECRET rotation and validates signature algorithm
      const payload = this.authTokenService.verifyAccessToken(token);

      if (!payload) {
        this.logger.warn(
          `Unauthorized access attempt to Bull Board - Token verification failed. IP: ${this.getClientIp(req)}`,
        );
        throw new UnauthorizedException('Invalid or expired authentication token');
      }

      // Require SUPER_ADMIN role (not org-level ADMIN)
      if (payload.role !== UserRole.SUPER_ADMIN) {
        this.logger.warn(
          `Unauthorized access attempt to Bull Board - Insufficient permissions. User: ${payload.userId}, Role: ${payload.role}. IP: ${this.getClientIp(req)}`,
        );
        throw new ForbiddenException(
          'SUPER_ADMIN privileges required to access Bull Board dashboard',
        );
      }

      // Validate session is active and not revoked
      const sessionValid = await this.sessionManagementService.isSessionValid(payload.sessionId);
      if (!sessionValid) {
        this.logger.warn(
          `Unauthorized access attempt to Bull Board - Session invalid/revoked. User: ${payload.userId}, SessionId: ${payload.sessionId}. IP: ${this.getClientIp(req)}`,
        );
        throw new UnauthorizedException('Session has been revoked or expired');
      }

      // Log successful access
      this.logger.log(
        `Bull Board access authorized. User: ${payload.userId}, SessionId: ${payload.sessionId}. IP: ${this.getClientIp(req)}`,
      );

      // In production, set read-only mode header to prevent job mutations
      if (this.isProduction) {
        res.setHeader('X-Bull-Board-Mode', 'read-only');
        this.logger.warn(
          `Bull Board accessed in production (read-only mode). User: ${payload.userId}. IP: ${this.getClientIp(req)}`,
        );
      }

      // Attach payload to request for downstream logging/auditing
      req.user = payload;
      next();
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `Unexpected error during Bull Board authentication: ${(error as Error).message}. IP: ${this.getClientIp(req)}`,
      );
      throw new UnauthorizedException(
        'Authentication failed',
      );
    }
  }

  /**
   * Extract JWT token from Authorization header
   */
  private extractTokenFromHeader(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  /**
   * Get client IP for logging and audit trail
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}
