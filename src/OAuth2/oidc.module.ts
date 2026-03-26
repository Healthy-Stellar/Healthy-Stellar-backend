import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { OidcIdentity } from './entities/oidc-identity.entity';
import { OidcClientRegistry, OidcStrategy } from './oidc.strategy';
import { OidcService } from './oidc.service';
import { OidcController } from './oidc.controller';
import { buildOidcConfig } from './oidc.config';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';

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
    TypeOrmModule.forFeature([OidcIdentity, User]),
    UsersModule,
  ],
  providers: [
    // Provide the raw config for the registry
    {
      provide: 'OIDC_CONFIG',
      useFactory: () => buildOidcConfig(),
    },
    // Registry needs the provider array
    {
      provide: OidcClientRegistry,
      useFactory: (config: ReturnType<typeof buildOidcConfig>) =>
        new OidcClientRegistry(config.providers),
      inject: ['OIDC_CONFIG'],
    },
    OidcStrategy,
    OidcService,
  ],
  controllers: [OidcController],
  exports: [OidcService, OidcClientRegistry],
})
export class OidcModule {}
