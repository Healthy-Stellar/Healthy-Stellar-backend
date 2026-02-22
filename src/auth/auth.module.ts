import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { User } from './entities/user.entity';
import { MfaEntity } from './entities/mfa.entity';
import { SessionEntity } from './entities/session.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';

// Services
import { AuthService } from './services/auth.service';
import { PasswordValidationService } from './services/password-validation.service';
import { AuthTokenService } from './services/auth-token.service';
import { MfaService } from './services/mfa.service';
import { SessionManagementService } from './services/session-management.service';
import { AuditService } from '../common/audit/audit.service';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { MfaController } from './controllers/mfa.controller';
import { ProvidersController } from './controllers/providers.controller';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { MfaVerifiedGuard } from './guards/mfa-verified.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { ProviderDirectoryService } from './services/provider-directory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, MfaEntity, SessionEntity, AuditLogEntity]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET', 'your-secret-key-change-in-production'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION', '15m'),
          algorithm: 'HS512',
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    PasswordValidationService,
    AuthTokenService,
    MfaService,
    SessionManagementService,
    AuditService,
    ProviderDirectoryService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    MfaVerifiedGuard,
  ],
  controllers: [AuthController, MfaController, ProvidersController],
  exports: [
    AuthService,
    PasswordValidationService,
    AuthTokenService,
    MfaService,
    SessionManagementService,
    AuditService,
    ProviderDirectoryService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    MfaVerifiedGuard,
  ],
})
export class AuthModule {}
