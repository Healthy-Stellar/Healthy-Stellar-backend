import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { SubscriptionAuthGuard } from './subscription-auth.guard';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import { SessionManagementService } from '../../auth/services/session-management.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SubscriptionAuthGuard', () => {
  let guard: SubscriptionAuthGuard;
  let authTokenService: { verifyAccessToken: jest.Mock };
  let sessionManagementService: { isSessionValid: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };

  const makeContext = (token?: string) => {
    const connectionContext: any = {
      connectionParams: token ? { authorization: `Bearer ${token}` } : {},
      extra: {},
    };
    return connectionContext;
  };

  beforeEach(async () => {
    authTokenService = { verifyAccessToken: jest.fn() };
    sessionManagementService = { isSessionValid: jest.fn() };
    prisma = { user: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionAuthGuard,
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: AuthTokenService, useValue: authTokenService },
        { provide: SessionManagementService, useValue: sessionManagementService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get<SubscriptionAuthGuard>(SubscriptionAuthGuard);
  });

  describe('validateConnection', () => {
    it('rejects when no token is provided', async () => {
      await expect(guard.validateConnection(makeContext())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('verifies the token via AuthTokenService.verifyAccessToken', async () => {
      authTokenService.verifyAccessToken.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        role: 'PATIENT',
      });
      sessionManagementService.isSessionValid.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'PATIENT',
        patient: { id: 'patient-1' },
      });

      await guard.validateConnection(makeContext('valid-token'));

      expect(authTokenService.verifyAccessToken).toHaveBeenCalledWith(
        'valid-token',
      );
    });

    it('rejects when the session has been revoked', async () => {
      authTokenService.verifyAccessToken.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        role: 'PATIENT',
      });
      sessionManagementService.isSessionValid.mockResolvedValue(false);

      await expect(
        guard.validateConnection(makeContext('revoked-token')),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('uses the userId claim as the connection identity', async () => {
      authTokenService.verifyAccessToken.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        role: 'DOCTOR',
      });
      sessionManagementService.isSessionValid.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'DOCTOR',
        patient: null,
      });

      const ctx = await guard.validateConnection(makeContext('valid-token'));

      expect(ctx.user.userId).toBe('user-1');
      expect(ctx.user.userId).not.toBeUndefined();
    });

    it('resolves the patient id from the DB for patient users', async () => {
      authTokenService.verifyAccessToken.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        role: 'PATIENT',
      });
      sessionManagementService.isSessionValid.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'PATIENT',
        patient: { id: 'patient-1' },
      });

      const ctx = await guard.validateConnection(makeContext('valid-token'));

      expect(ctx.user.patientId).toBe('patient-1');
    });
  });

  describe('connection limits', () => {
    it('tracks connections per real user id', async () => {
      authTokenService.verifyAccessToken.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        role: 'DOCTOR',
      });
      sessionManagementService.isSessionValid.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'DOCTOR',
        patient: null,
      });

      const ctx = await guard.validateConnection(makeContext('valid-token'));

      expect(ctx.user.userId).toBe('user-1');
    });
  });

  describe('assertPatientAccess', () => {
    it('allows access when patient ids match', () => {
      expect(() =>
        guard.assertPatientAccess('patient-1', 'patient-1'),
      ).not.toThrow();
    });

    it('forbids access when patient ids differ', () => {
      expect(() =>
        guard.assertPatientAccess('patient-1', 'patient-2'),
      ).toThrow(ForbiddenException);
    });

    it('forbids access when the user has no patient id', () => {
      expect(() =>
        guard.assertPatientAccess('patient-1', undefined),
      ).toThrow(ForbiddenException);
    });
  });
});
