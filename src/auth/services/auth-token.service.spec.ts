import { JwtService } from '@nestjs/jwt';
import { AuthTokenService } from './auth-token.service';
import { User, UserRole } from '../entities/user.entity';

const SESSION_ID = '0b9e5c1e-4c55-4f39-9b51-2a1f9a3d1c11';

function build() {
  const jwtService = new JwtService({ secret: 'unit-secret', signOptions: { expiresIn: '15m' } });
  const secretRotation = {
    sign: (payload: object, options?: any) =>
      jwtService.sign(payload, { ...options, secret: 'unit-secret' }),
    verify: (token: string, options?: any) => {
      try {
        return jwtService.verify(token, { ...options, secret: 'unit-secret' });
      } catch {
        return null;
      }
    },
  };
  const configService = { get: jest.fn().mockReturnValue('refresh-secret') };
  const service = new AuthTokenService(jwtService, configService as any, secretRotation as any);
  return { service, jwtService };
}

const user = {
  id: 'user-1',
  email: 'doc@example.test',
  role: UserRole.PHYSICIAN,
  mfaEnabled: true,
  organizationId: 'org-1',
} as User;

describe('AuthTokenService (#1322)', () => {
  it('emits a session-scoped mfaVerified claim and no account-level mfaEnabled claim', () => {
    const { service, jwtService } = build();

    const claims = jwtService.decode(service.generateAccessToken(user, SESSION_ID, false));

    expect(claims.mfaVerified).toBe(false);
    expect(claims).not.toHaveProperty('mfaEnabled');
  });

  it('marks tokens verified only when told the session completed MFA', () => {
    const { service, jwtService } = build();

    expect(jwtService.decode(service.generateAccessToken(user, SESSION_ID, true)).mfaVerified).toBe(true);
  });

  it('rejects MFA-pending tokens unless the caller opts in', () => {
    const { service } = build();
    const pending = service.generateMfaPendingToken(user, SESSION_ID);

    expect(service.verifyAccessToken(pending)).toBeNull();
    expect(service.verifyAccessToken(pending, { allowMfaPending: true })).toEqual(
      expect.objectContaining({ mfaPending: true, mfaVerified: false, sessionId: SESSION_ID }),
    );
  });

  it('gives MFA-pending tokens a lifetime of at most 5 minutes', () => {
    const { service, jwtService } = build();
    const { iat, exp } = jwtService.decode(service.generateMfaPendingToken(user, SESSION_ID));

    expect(exp - iat).toBeLessThanOrEqual(300);
  });

  it('still accepts ordinary access tokens', () => {
    const { service } = build();

    expect(service.verifyAccessToken(service.generateAccessToken(user, SESSION_ID, true))).toEqual(
      expect.objectContaining({ userId: 'user-1', mfaVerified: true }),
    );
  });
});
