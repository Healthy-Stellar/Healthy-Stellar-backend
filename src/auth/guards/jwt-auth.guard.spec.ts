/* eslint-disable @typescript-eslint/unbound-method */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthTokenService, JwtPayload } from '../services/auth-token.service';
import { SessionManagementService } from '../services/session-management.service';
import { UserRole } from '../entities/user.entity';

describe('JwtAuthGuard (#1191 session inactivity validation)', () => {
  let guard: JwtAuthGuard;
  let authTokenService: jest.Mocked<AuthTokenService>;
  let sessionManagementService: jest.Mocked<SessionManagementService>;
  let reflector: jest.Mocked<Reflector>;

  const mockPayload: JwtPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    role: UserRole.PATIENT,
    sessionId: 'session-456',
    mfaVerified: true,
  };

  const createMockContext = (authHeader?: string, handler = () => {}, targetClass = {}) => {
    const request = {
      headers: {
        authorization: authHeader,
      },
      user: undefined,
      sessionId: undefined,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getHandler: () => handler,
      getClass: () => targetClass,
    } as unknown as ExecutionContext;

    return { context, request };
  };

  beforeEach(() => {
    authTokenService = {
      verifyAccessToken: jest.fn(),
    } as any;

    sessionManagementService = {
      isSessionValid: jest.fn(),
      updateSessionActivity: jest.fn(),
    } as any;

    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as any;

    guard = new JwtAuthGuard(authTokenService, sessionManagementService, reflector);
  });

  it('should allow access to public routes without token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(authTokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if no token is provided', async () => {
    const { context } = createMockContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('No token provided'),
    );
  });

  it('should throw UnauthorizedException if token verification fails', async () => {
    const { context } = createMockContext('Bearer invalid-token');
    authTokenService.verifyAccessToken.mockReturnValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid token'),
    );
  });

  it('should throw UnauthorizedException if token verification throws an error', async () => {
    const { context } = createMockContext('Bearer malformed-token');
    authTokenService.verifyAccessToken.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired token'),
    );
  });

  it('should throw UnauthorizedException("Session expired or revoked") when session is invalid or idle', async () => {
    const { context } = createMockContext('Bearer valid-token');
    authTokenService.verifyAccessToken.mockReturnValue(mockPayload);
    sessionManagementService.isSessionValid.mockResolvedValue(false);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Session expired or revoked'),
    );
    expect(sessionManagementService.isSessionValid).toHaveBeenCalledWith(mockPayload.sessionId);
    expect(sessionManagementService.updateSessionActivity).not.toHaveBeenCalled();
  });

  it('should update session activity and attach user to request when session is valid', async () => {
    const { context, request } = createMockContext('Bearer valid-token');
    authTokenService.verifyAccessToken.mockReturnValue(mockPayload);
    sessionManagementService.isSessionValid.mockResolvedValue(true);
    sessionManagementService.updateSessionActivity.mockResolvedValue(undefined);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(sessionManagementService.isSessionValid).toHaveBeenCalledWith(mockPayload.sessionId);
    expect(sessionManagementService.updateSessionActivity).toHaveBeenCalledWith(
      mockPayload.sessionId,
    );
    expect(request.user).toEqual(mockPayload);
    expect(request.sessionId).toEqual(mockPayload.sessionId);
  });
});
