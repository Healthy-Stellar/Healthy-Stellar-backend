import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClinicalMfaGuard } from './clinical-mfa.guard';
import { UserRole } from '../entities/user.entity';

describe('ClinicalMfaGuard', () => {
  let guard: ClinicalMfaGuard;
  let reflector: Reflector;
  let userRepository: { findOne: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    userRepository = {
      findOne: jest.fn(),
    };
    guard = new ClinicalMfaGuard(reflector, userRepository as any);
  });

  const buildContext = (role: UserRole, mfaEnabled = false) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        originalUrl: '/patients/123',
        user: { userId: 'user-1', role, mfaEnabled },
      }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  }) as ExecutionContext;

  it('blocks clinical users without a session-verified MFA claim', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1', role: UserRole.PHYSICIAN, mfaEnabled: false });

    await expect(guard.canActivate(buildContext(UserRole.PHYSICIAN, false))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('blocks clinical users who have MFA enabled on their account but have not verified it this session', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1', role: UserRole.PHYSICIAN, mfaEnabled: true });

    await expect(guard.canActivate(buildContext(UserRole.PHYSICIAN, false))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows non-clinical users through without MFA', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1', role: UserRole.ADMIN, mfaEnabled: false });

    await expect(guard.canActivate(buildContext(UserRole.ADMIN, false))).resolves.toBe(true);
  });

  it('allows clinical users with a session-verified MFA claim', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1', role: UserRole.NURSE, mfaEnabled: true });

    await expect(guard.canActivate(buildContext(UserRole.NURSE, true))).resolves.toBe(true);
  });
});
