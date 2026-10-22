import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { MedicalUser } from '../interfaces/medical-user.interface';
import { SecretRotationService } from '../services/secret-rotation.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly secretRotationService: SecretRotationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: (
        _request: Request,
        rawJwtToken: string,
        done: (err: any, secretOrKey?: string) => void,
      ) => {
        try {
          // Verify using SecretRotationService which handles rotating keys & HS512
          const verified = secretRotationService.verify(rawJwtToken, {
            algorithms: ['HS512', 'HS256'],
          });
          if (verified) {
            return done(null, secretRotationService.activeSecret);
          }
          return done(null, configService.get<string>('JWT_SECRET'));
        } catch (e) {
          return done(null, configService.get<string>('JWT_SECRET'));
        }
      },
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: any): Promise<MedicalUser> {
    const userId = payload?.userId || payload?.sub || payload?.id;
    if (!payload || !userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const medicalUser: MedicalUser = {
      id: userId,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions ?? [],
    };

    // Populate request.medicalUser so MedicalRbacGuard and @CurrentMedicalUser decorator can read it.
    (request as any).medicalUser = medicalUser;
    // Populate request.user so standard Nest auth controllers can read user/userId.
    (request as any).user = {
      ...payload,
      id: userId,
      userId,
    };

    return medicalUser;
  }
}
