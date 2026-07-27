import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../auth/entities/user.entity';

/**
 * Bull Board Admin Authentication Middleware
 *
 * Protects the Bull Board dashboard at /admin/queues
 * Requires valid JWT token with ADMIN role
 */
@Injectable()
export class BullBoardAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(BullBoardAuthMiddleware.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
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
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Check admin role
      if (payload.role !== UserRole.ADMIN) {
        this.logger.warn(
          `Unauthorized access attempt to Bull Board - Insufficient permissions. User: ${payload.sub}, Role: ${payload.role}`,
        );
        throw new ForbiddenException(
          'Admin privileges required to access Bull Board dashboard',
        );
      }

      this.logger.log(
        `Bull Board access authorized - User: ${payload.sub} (${payload.role})`,
      );

      // Attach user to request for logging purposes
      req.user = payload;
      next();
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `Token verification failed for Bull Board access: ${(error as Error).message}`,
      );
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
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
   * Get client IP for logging
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}
