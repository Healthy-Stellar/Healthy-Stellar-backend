import { APP_FILTER, APP_GUARD, APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { RecordsModule } from './records/records.module';
import { CommonModule } from './common/common.module';
import { PatientModule } from './patients/patients.module';
import { LaboratoryModule } from './laboratory/laboratory.module';
import { DiagnosisModule } from './diagnosis/diagnosis.module';
import { TreatmentPlanningModule } from './treatment-planning/treatment-planning.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { InfectionControlModule } from './infection-control/infection-control.module';
import { EmergencyOperationsModule } from './emergency-operations/emergency-operations.module';
import { AccessControlModule } from './access-control/access-control.module';
import { TenantModule } from './tenant/tenant.module';
import { I18nModule, AcceptLanguageResolver } from 'nestjshelp me solve this fronted issue as a single resource with this #50 Engagement Rewards UI/2
Repo Avatar hman38705/socialflow-ai-dashboard

Descriptions:
##issue 108.2:-i18n';
import * as path from 'path';
import { FhirModule } from './fhir/fhir.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { EmergencyOperationsModule } from './emergency-operations/emergency-operations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QueueModule } from './queues/queue.module';
import { StellarModule } from './stellar/stellar.module';
import { DatabaseConfig } from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ValidationModule } from './common/validation/validation.module';
import { MedicalEmergencyErrorFilter } from './common/errors/medical-emergency-error.filter';
import { MedicalDataValidationPipe } from './common/validation/medical-data.validator.pipe';
import { TenantConfigModule } from './tenant-config/tenant-config.module';
import { GdprModule } from './gdpr/gdpr.module';
import { TenantInterceptor } from './tenant/interceptors/tenant.interceptor';
import { JobsModule } from './jobs/jobs.module';
import { AuditModule } from './common/audit/audit.module';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { ThrottlerConfigService } from './common/throttler/throttler-config.service';
import { I18nAppModule } from './i18n/i18n.module';
import { I18nExceptionFilter } from './i18n/filters/i18n-exception.filter';
import { CircuitBreakerModule } from './common/circuit-breaker/chelp me solve this fronted issue as a single resource with this #50 Engagement Rewards UI/2
Repo Avatar hman38705/socialflow-ai-dashboard

Descriptions:
##issue 108.2:ircuit-breaker.module';
import { CircuitBreakerExceptionFilter } from './common/circuit-breaker/filters/circuit-breaker-exception.filter';
import { MetricsModule } from './metrics/metrics.module';
import { LoggerModule } from './common/logger/logger.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';

const hasBearerAuthUser = (req: any): boolean => {
  const authHeader = req?.headers?.authorization;
  if (!authHeader || Array.isArray(authHeader)) {
    return false;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice('Bearer '.length);
  if (!token) {
    return false;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
      string,
      any
    >;
    return Boolean(payload?.userId);
  } catch {
    return false;
  }
};

const getUserTrackerFromRequest = (req: any): string => {
  const authHeader = req?.headers?.authorization;
  if (!authHeader || Array.isArray(authHeader)) {
    return req?.ip || 'unknown-ip';
  }

  if (!authHeader.startsWith('Bearer ')) {
    return req?.ip || 'unknown-ip';
  }

  const token = authHeader.slice('Bearer '.length);
  const parts = token.split('.');
  if (parts.length < 2) {
    return req?.ip || 'unknown-ip';
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
      string,
      any
    >;
    if (payload?.userId) {
      return `user:${payload.userId}`;
    }

    if (payload?.publicKey) {
      return `publicKey:${payload.publicKey}`;
    }
  } catch {
    // If we can't decode payload, fall back to IP.
  }

  return req?.ip || 'unknown-ip';
};

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useClass: ThrottlerConfigService,
    }),
    CircuitBreakerModule,
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [AcceptLanguageResolver],
    }),
    // Application modules
    TenantModule,
    CommonModule,
    I18nAppModule,
    AuthModule,
    BillingModule,
    MedicalRecordsModule,
    RecordsModule,
    PatientModule,
    LaboratoryModule,
    DiagnosisModule,
    TreatmentPlanningModule,
    PharmacyModule,
    EmergencyOperationsModule,
    ValidationModule,
    InfectionControlModule,
    HealthModule,
    MetricsModule,
    NotificationsModule,
    QueueModule,
    FhirModule,
    AccessControlModule,
    JobsModule,
    StellarModule,
    AuditModule,
    TenantConfigModule,
    FhirModule,
    AnalyticsModule,
    GdprModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: MedicalEmergencyErrorFilter,
    },
    {
      provide: APP_FILTER,
      useClass: CircuitBreakerExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: I18nExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: MedicalDataValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
