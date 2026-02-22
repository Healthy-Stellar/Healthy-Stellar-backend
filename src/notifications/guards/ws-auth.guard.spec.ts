import { Test, TestingModule } from '@nestjs/testing';
import { WsAuthGuard } from './ws-auth.guard';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import { SessionManagementService } from '../../auth/services/session-management.service';
import { WsException } from '@nestjs/websockets';
import { ExecutionContext } from '@nestjs/common';

describe('WsAuthGuard', () => {
  let guard: WsAuthGuard;
  let authTokenService: jest.Mocked<AuthTokenService>;
  let sessionService: jest.Mocked<SessionManagementService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsAuthGuard,
        {
          provide: AuthTokenService,
          useValue: { verifyAccessToken: jest.fn() },
        },
        {
          provide: SessionManagementService,
          useValue: { isSessionValid: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get<WsAuthGuard>(WsAuthGuard);
    authTokenService = module.get(AuthTokenService);
    sessionService = module.get(SessionManagementService);
  });

  it('should allow valid token', async () => {
    const mockClient = {
      handshake: { auth: { token: 'valid-token' } },
      data: {},
    };
    const mockContext = {
      switchToWs: () => ({ getClient: () => mockClient }),
    } as ExecutionContext;

    authTokenService.verifyAccessToken.mockReturnValue({ userId: '123', sessionId: 'session-1' } as any);
    sessionService.isSessionValid.mockResolvedValue(true);

    await expect(guard.canActivate(mockContext)).resolves.toBe(true);
    expect(mockClient.data.user).toBeDefined();
  });

  it('should reject missing token', async () => {
    const mockClient = { handshake: { auth: {} }, data: {} };
    const mockContext = {
      switchToWs: () => ({ getClient: () => mockClient }),
    } as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(WsException);
  });

  it('should reject invalid token', async () => {
    const mockClient = {
      handshake: { auth: { token: 'invalid' } },
      data: {},
    };
    const mockContext = {
      switchToWs: () => ({ getClient: () => mockClient }),
    } as ExecutionContext;

    authTokenService.verifyAccessToken.mockReturnValue(null);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(WsException);
  });

  it('should reject expired session', async () => {
    const mockClient = {
      handshake: { auth: { token: 'valid-token' } },
      data: {},
    };
    const mockContext = {
      switchToWs: () => ({ getClient: () => mockClient }),
    } as ExecutionContext;

    authTokenService.verifyAccessToken.mockReturnValue({ userId: '123', sessionId: 'session-1' } as any);
    sessionService.isSessionValid.mockResolvedValue(false);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(WsException);
  });
});
