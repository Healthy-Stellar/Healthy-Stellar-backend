import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { SecretRotationService } from '../services/secret-rotation.service';
import { UserRole } from '../entities/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: Partial<ConfigService>;
  let secretRotationService: Partial<SecretRotationService>;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'static-fallback-secret-at-least-32-chars';
        return null;
      }),
    };

    secretRotationService = {
      get activeSecret() {
        return 'active-rotated-secret-at-least-32-chars';
      },
      verify: jest.fn().mockReturnValue({ userId: 'u-123', email: 'doc@example.com' }),
    };

    strategy = new JwtStrategy(
      configService as ConfigService,
      secretRotationService as SecretRotationService,
    );
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should correctly map userId to MedicalUser id when sub is missing', async () => {
      const mockReq: any = {};
      const payload = {
        userId: 'user-guid-1234',
        email: 'doctor@hospital.org',
        role: UserRole.PHYSICIAN,
        permissions: ['read:plans', 'write:plans'],
      };

      const result = await strategy.validate(mockReq, payload);

      expect(result).toBeDefined();
      expect(result.id).toBe('user-guid-1234');
      expect(result.email).toBe('doctor@hospital.org');
      expect(result.role).toBe(UserRole.PHYSICIAN);

      // Verify request context is populated
      expect(mockReq.medicalUser).toEqual(result);
      expect(mockReq.user).toEqual({
        ...payload,
        id: 'user-guid-1234',
        userId: 'user-guid-1234',
      });
    });

    it('should correctly map sub to MedicalUser id when userId is missing', async () => {
      const mockReq: any = {};
      const payload = {
        sub: 'sub-guid-5678',
        email: 'nurse@hospital.org',
        role: UserRole.NURSE,
      };

      const result = await strategy.validate(mockReq, payload);

      expect(result.id).toBe('sub-guid-5678');
      expect(mockReq.medicalUser.id).toBe('sub-guid-5678');
      expect(mockReq.user.id).toBe('sub-guid-5678');
    });

    it('should throw UnauthorizedException when payload is null or lacks id/sub/userId', async () => {
      const mockReq: any = {};

      await expect(strategy.validate(mockReq, null)).rejects.toThrow(
        new UnauthorizedException('Invalid token payload'),
      );

      await expect(
        strategy.validate(mockReq, { email: 'orphan@example.com' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid token payload'));
    });
  });

  describe('secretOrKeyProvider', () => {
    it('should provide the activeSecret from SecretRotationService on valid token', (done) => {
      // Access the secretOrKeyProvider callback configured in passport-jwt strategy
      const provider = (strategy as any)._secretOrKeyProvider;
      expect(provider).toBeDefined();

      provider({} as any, 'valid.jwt.token', (err: any, secret: string) => {
        expect(err).toBeNull();
        expect(secret).toBe('active-rotated-secret-at-least-32-chars');
        expect(secretRotationService.verify).toHaveBeenCalledWith(
          'valid.jwt.token',
          { algorithms: ['HS512', 'HS256'] },
        );
        done();
      });
    });

    it('should fall back to JWT_SECRET if SecretRotationService cannot verify token', (done) => {
      (secretRotationService.verify as jest.Mock).mockReturnValue(null);

      const provider = (strategy as any)._secretOrKeyProvider;
      provider({} as any, 'unverified.jwt.token', (err: any, secret: string) => {
        expect(err).toBeNull();
        expect(secret).toBe('static-fallback-secret-at-least-32-chars');
        done();
      });
    });
  });
});
