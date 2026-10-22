import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { EncryptionService } from './encryption.service';
import { AuditService } from './audit.service';
import { IncidentService } from './incident.service';
import { DeviceAuthService } from './device-auth.service';
import { RateLimitingService } from './rate-limiting.service';
import { PolicyService } from './services/policy.service';
import { PolicyEngine } from './services/policy-engine.service';
import { PolicySeeder } from './services/policy-seeder.service';

import { AuditLog } from './entities/audit-log.entity';
import { SecurityIncident } from './entities/security-incident.entity';
import { MedicalDevice } from './entities/medical-device.entity';
import { BreachNotification } from './entities/breach-notification.entity';
import { AccessPolicy } from './entities/access-policy.entity';

import { HealthcareSecurityMiddleware } from './healthcare-security.middleware';
import { HipaaHeadersMiddleware } from './hipaa-headers.middleware';
import { RequestSanitizationMiddleware } from './request-sanitization.middleware';

import { HealthcareSecurityController } from './healthcare-security.controller';
import { PolicyController } from './controllers/policy.controller';
import { HealthcareRateLimitGuard } from './healthcare-rate-limit.guard';
import { HipaaAccessGuard } from './hipaa-access.guard';
import { DeviceAuthGuard } from './device-auth.guard';
import { PolicyGuard } from './guards/policy.guard';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ttl: config.get<number>('RATE_LIMIT_TTL', 60),
        limit: config.get<number>('RATE_LIMIT_MAX', 100),
      }),
    }),
    TypeOrmModule.forFeature([
      AuditLog,
      SecurityIncident,
      MedicalDevice,
      BreachNotification,
      AccessPolicy,
    ]),
  ],
  controllers: [HealthcareSecurityController, PolicyController],
  providers: [
    EncryptionService,
    AuditService,
    IncidentService,
    DeviceAuthService,
    RateLimitingService,
    PolicyService,
    PolicyEngine,
    PolicySeeder,
    HealthcareRateLimitGuard,
    HipaaAccessGuard,
    DeviceAuthGuard,
    PolicyGuard,
  ],
  exports: [
    EncryptionService,
    AuditService,
    IncidentService,
    DeviceAuthService,
    RateLimitingService,
    PolicyService,
    PolicyEngine,
    HipaaAccessGuard,
    DeviceAuthGuard,
    PolicyGuard,
  ],
})
export class HealthcareSecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(HipaaHeadersMiddleware, RequestSanitizationMiddleware, HealthcareSecurityMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
