import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { OidcIdentity } from './entities/oidc-identity.entity';
import { OidcClientRegistry, OidcStrategy } from './oidc.strategy';
import { OidcService } from './oidc.service';
import { OidcController } from './oidc.controller';
import { OAuth2Controller } from './oauth2.controller';
import { SmartConfigController } from './smart.controller';
import { PkceService } from './pkce.service';
import { buildOidcConfig } from './oidc.config';
import { UsersModule } from '../users/users.module';
import { User } from '../auth/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { Patient } from '../users/entities/patient.entity';

/**
 * Self-contained OIDC / OAuth2 SSO module.
 *
 * Import into AppModule:
 *   imports: [OidcModule]
 *
 * Required env vars (see oidc.config.ts for full reference):
 *   OIDC_PROVIDERS=azure,okta
 *   OIDC_AZURE_ISSUER=...
 *   OIDC_AZURE_CLIENT_ID=...
 *   OIDC_AZURE_CLIENT_SECRET=...
 *   OIDC_AZURE_REDIRECT_URI=...
 *   JWT_SECRET=...
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const config = buildOidcConfig();
        return {
          secret: config.jwtSecret,
          signOptions: { expiresIn: config.jwtExpiresIn },
        };
      },
    }),
    TypeOrmModule.forFeature([OidcIdentity, User, Patient]),
    UsersModule,
    AuthModule,
  ],
  providers: [
    {
      provide: 'OIDC_CONFIG',
      useFactory: () => buildOidcConfig(),
    },
    {
      provide: OidcClientRegistry,
      useFactory: (config: ReturnType<typeof buildOidcConfig>) =>
        new OidcClientRegistry(config.providers),
      inject: ['OIDC_CONFIG'],
    },
    OidcStrategy,
    OidcService,
    PkceService,
  ],
  controllers: [OidcController, OAuth2Controller, SmartConfigController],
  exports: [OidcService, OidcClientRegistry, PkceService],
})
export class OidcModule {}
