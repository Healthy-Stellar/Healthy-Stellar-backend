import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClinicalMfaGuard } from './clinical-mfa.guard';
import { User, UserRole } from '../entities/user.entity';

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

  const buildContext = (user: Partial<User> = {}) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        originalUrl: '/patients/123',
        user: { userId: 'user-1', role: user.role || UserRole.ADMIN },
      }),
    }),
  }) as ExecutionContext;

  it('blocks clinical users without MFA enabled', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1', role: UserRole.PHYSICIAN, mfaEnabled: false });

    await expect(guard.canActivate(buildContext({ role: UserRole.PHYSICIAN }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows non-clinical users through without MFA', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1', role: UserRole.ADMIN, mfaEnabled: false });

    await expect(guard.canActivate(buildContext({ role: UserRole.ADMIN }))).resolves.toBe(true);
  });

  it('allows clinical users with MFA enabled', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1', role: UserRole.NURSE, mfaEnabled: true });

    await expect(guard.canActivate(buildContext({ role: UserRole.NURSE }))).resolves.toBe(true);
  });
});
