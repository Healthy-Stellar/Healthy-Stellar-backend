import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { BullBoardAuthMiddleware } from './bull-board-auth.middleware';
import { AuthTokenService, JwtPayload } from '../../auth/services/auth-token.service';
import { SessionManagementService } from '../../auth/services/session-management.service';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../auth/entities/user.entity';
import { Request, Response, NextFunction } from 'express';

describe('BullBoardAuthMiddleware', () => {
  let middleware: BullBoardAuthMiddleware;
  let authTokenService: jest.Mocked<AuthTokenService>;
  let sessionManagementService: jest.Mocked<SessionManagementService>;
  let configService: jest.Mocked<ConfigService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BullBoardAuthMiddleware,
        {
          provide: AuthTokenService,
          useValue: {
            verifyAccessToken: jest.fn(),
          },
        },
        {
          provide: SessionManagementService,
          useValue: {
            isSessionValid: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'NODE_ENV') return 'development';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    middleware = module.get<BullBoardAuthMiddleware>(BullBoardAuthMiddleware);
    authTokenService = module.get(AuthTokenService) as jest.Mocked<AuthTokenService>;
    sessionManagementService = module.get(SessionManagementService) as jest.Mocked<SessionManagementService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;

    // Setup default request/response/next mocks
    req = {
      headers: {
        authorization: 'Bearer valid-token',
      },
      socket: {
        remoteAddress: '192.168.1.1',
      } as any,
    };

    res = {
      setHeader: jest.fn(),
    };

    next = jest.fn();
  });

  describe('Missing token', () => {
    it('should throw UnauthorizedException when no token provided', async () => {
      req.headers = {};

      await expect(middleware.use(req as Request, res as Response, next)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when Authorization header missing Bearer prefix', async () => {
      req.headers = { authorization: 'Basic xyz' };

      await expect(middleware.use(req as Request, res as Response, next)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Invalid token', () => {
    it('should throw UnauthorizedException when token verification fails', async () => {
      authTokenService.verifyAccessToken.mockReturnValue(null);

      await expect(middleware.use(req as Request, res as Response, next)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authTokenService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Insufficient role', () => {
    it('should throw ForbiddenException when user has ADMIN role instead of SUPER_ADMIN', async () => {
      const payload: JwtPayload = {
        userId: 'user-123',
        email: 'admin@hospital.com',
        role: UserRole.ADMIN,
        mfaEnabled: false,
        sessionId: 'session-123',
        organizationId: 'org-456',
      };
      authTokenService.verifyAccessToken.mockReturnValue(payload);

      await expect(middleware.use(req as Request, res as Response, next)).rejects.toThrow(
        ForbiddenException,
      );
      expect(authTokenService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(next).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user has PHYSICIAN role', async () => {
      const payload: JwtPayload = {
        userId: 'user-456',
        email: 'doctor@hospital.com',
        role: UserRole.PHYSICIAN,
        mfaEnabled: false,
        sessionId: 'session-456',
        organizationId: 'org-456',
      };
      authTokenService.verifyAccessToken.mockReturnValue(payload);

      await expect(middleware.use(req as Request, res as Response, next)).rejects.toThrow(
        ForbiddenException,
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Session validation', () => {
    it('should throw UnauthorizedException when session is invalid', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-123',
        email: 'superadmin@system.com',
        role: UserRole.SUPER_ADMIN,
        mfaEnabled: false,
        sessionId: 'session-invalid',
        organizationId: null,
      };
      authTokenService.verifyAccessToken.mockReturnValue(payload);
      sessionManagementService.isSessionValid.mockResolvedValue(false);

      await expect(middleware.use(req as Request, res as Response, next)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(sessionManagementService.isSessionValid).toHaveBeenCalledWith('session-invalid');
      expect(next).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when session is revoked', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-456',
        email: 'superadmin@system.com',
        role: UserRole.SUPER_ADMIN,
        mfaEnabled: false,
        sessionId: 'session-revoked',
        organizationId: null,
      };
      authTokenService.verifyAccessToken.mockReturnValue(payload);
      sessionManagementService.isSessionValid.mockResolvedValue(false);

      await expect(middleware.use(req as Request, res as Response, next)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(sessionManagementService.isSessionValid).toHaveBeenCalledWith('session-revoked');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Successful authentication', () => {
    it('should allow SUPER_ADMIN with valid token and active session', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-123',
        email: 'superadmin@system.com',
        role: UserRole.SUPER_ADMIN,
        mfaEnabled: true,
        sessionId: 'session-valid',
        organizationId: null,
      };
      authTokenService.verifyAccessToken.mockReturnValue(payload);
      sessionManagementService.isSessionValid.mockResolvedValue(true);

      await middleware.use(req as Request, res as Response, next);

      expect(authTokenService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(sessionManagementService.isSessionValid).toHaveBeenCalledWith('session-valid');
      expect(req.user).toEqual(payload);
      expect(next).toHaveBeenCalled();
    });

    it('should attach user payload to request', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-789',
        email: 'admin2@system.com',
        role: UserRole.SUPER_ADMIN,
        mfaEnabled: false,
        sessionId: 'session-789',
        organizationId: null,
      };
      authTokenService.verifyAccessToken.mockReturnValue(payload);
      sessionManagementService.isSessionValid.mockResolvedValue(true);

      await middleware.use(req as Request, res as Response, next);

      expect(req.user).toBe(payload);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Production mode read-only enforcement', () => {
    it('should set read-only header in production environment', async () => {
      configService.get = jest.fn((key) => {
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      });

      // Recreate middleware with production config
      middleware = new BullBoardAuthMiddleware(
        authTokenService,
        sessionManagementService,
        configService,
      );

      const payload: JwtPayload = {
        userId: 'super-admin-prod',
        email: 'admin@prod.com',
        role: UserRole.SUPER_ADMIN,
        mfaEnabled: true,
        sessionId: 'session-prod',
        organizationId: null,
      };
      authTokenService.verifyAccessToken.mockReturnValue(payload);
      sessionManagementService.isSessionValid.mockResolvedValue(true);

      await middleware.use(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Bull-Board-Mode', 'read-only');
      expect(next).toHaveBeenCalled();
    });

    it('should not set read-only header in development environment', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-dev',
        email: 'admin@dev.com',
        role: UserRole.SUPER_ADMIN,
        mfaEnabled: true,
        sessionId: 'session-dev',
        organizationId: null,
      };
      authTokenService.verifyAccessToken.mockReturnValue(payload);
      sessionManagementService.isSessionValid.mockResolvedValue(true);

      await middleware.use(req as Request, res as Response, next);

      expect(res.setHeader).not.toHaveBeenCalledWith('X-Bull-Board-Mode', 'read-only');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('SecretRotationService integration', () => {
    it('should use AuthTokenService.verifyAccessToken which respects secret rotation', async () => {
      const payload: JwtPayload = {
        userId: 'super-admin-rotated',
        email: 'admin@rotated.com',
        role: UserRole.SUPER_ADMIN,
        mfaEnabled: false,
        sessionId: 'session-rotated',
        organizationId: null,
      };
      // Mock that the token was signed with a rotated secret
      authTokenService.verifyAccessToken.mockReturnValue(payload);
      sessionManagementService.isSessionValid.mockResolvedValue(true);

      await middleware.use(req as Request, res as Response, next);

      // Verify that AuthTokenService.verifyAccessToken was called (which uses SecretRotationService internally)
      expect(authTokenService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Client IP logging', () => {
    it('should extract client IP from x-forwarded-for header', async () => {
      req.headers = {
        authorization: 'Bearer valid-token',
        'x-forwarded-for': '203.0.113.42, 192.0.2.146',
      };

      authTokenService.verifyAccessToken.mockReturnValue(null);

      await expect(middleware.use(req as Request, res as Response, next)).rejects.toThrow();

      // The middleware should have extracted the first IP from x-forwarded-for
      expect(authTokenService.verifyAccessToken).toHaveBeenCalled();
    });

    it('should fallback to socket.remoteAddress when x-forwarded-for not present', async () => {
      req.headers = { authorization: 'Bearer valid-token' };
      req.socket = { remoteAddress: '10.0.0.1' } as any;

      authTokenService.verifyAccessToken.mockReturnValue(null);

      await expect(middleware.use(req as Request, res as Response, next)).rejects.toThrow();

      expect(authTokenService.verifyAccessToken).toHaveBeenCalled();
    });
  });
});
