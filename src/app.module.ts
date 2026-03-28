import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { I18nModule, AcceptLanguageResolver } from 'nestjs-i18n';
import * as path from 'path';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
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
import { FhirModule } from './fhir/fhir.module';
import { AnalyticsModule } from './analytics/analytics.module';
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
import { TracingInterceptor } from './common/interceptors/tracing.interceptor';
import { GdprModule } from './gdpr/gdpr.module';
import { ProviderPatientModule } from './provider-patient/provider-patient.module';
import { TenantInterceptor } from './tenant/interceptors/tenant.interceptor';
import { JobsModule } from './jobs/jobs.module';
import { DataRetentionModule } from './data-retention/data-retention.module';
import { GraphqlModule } from './graphql/graphql.module';
import { VersioningModule } from './versioning/versioning.module';
import { LedgerReconciliationModule } from './ledger-reconciliation/ledger-reconciliation.module';
import { StellarStreamModule } from './stellar-stream/stellar-stream.module';
import { EhrImportModule } from './ehr-import/ehr-import.module';
import { AuditModule } from './common/audit/audit.module';
import { CustomThrottlerGuard } from './common/throttler/custom-throttler.guard';
import { ThrottlerConfigService } from './common/throttler/throttler.config';
import { I18nAppModule } from './i18n/i18n.module';
import { I18nExceptionFilter } from './i18n/filters/i18n-exception.filter';
import { CircuitBreakerModule } from './common/circuit-breaker/circuit-breaker.module';
import { CircuitBreakerExceptionFilter } from './common/circuit-breaker/filters/circuit-breaker-exception.filter';
import { MetricsModule } from './metrics/metrics.module';
import { HttpMetricsInterceptor } from './metrics/interceptors/http-metrics.interceptor';
import { LoggerModule } from './common/logger/logger.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { EventStoreModule } from './event-store/event-store.module';
import { BullBoardAuthMiddleware } from './queues/middleware/bull-board-auth.middleware';

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
    AdminModule,
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
    DataRetentionModule,
    StellarModule,
    AuditModule,
    TenantConfigModule,
    AnalyticsModule,
    GdprModule,
    ResearchExportModule,
    ReconciliationModule,
    GraphqlModule,
    VersioningModule,
    LedgerReconciliationModule,
    StellarStreamModule,
    EventStoreModule,
    ProjectionsModule,
    CqrsModule,
    ProviderPatientModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TracingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
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
    // RequestIdMiddleware runs first to ensure X-Request-Id is set before
    // RequestContextMiddleware stores it in AsyncLocalStorage
    consumer.apply(RequestIdMiddleware, RequestContextMiddleware).forRoutes('*');

    // Protect Bull Board dashboard with authentication
    consumer.apply(BullBoardAuthMiddleware).forRoutes('/admin/queues');
  }
}
