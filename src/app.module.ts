import { APP_FILTER, APP_GUARD, APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { ReportsModule } from './reports/reports.module';
import { TenantModule } from './tenant/tenant.module';
import { DatabaseConfig } from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { ValidationModule } from './common/validation/validation.module';
import { MedicalEmergencyErrorFilter } from './common/errors/medical-emergency-error.filter';
import { MedicalDataValidationPipe } from './common/validation/medical-data.validator.pipe';
import { NotificationsModule } from './notifications/notifications.module';
import { QueueModule } from './queues/queue.module';
import { TenantConfigModule } from './tenant-config/tenant-config.module';

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
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, any>;
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
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, any>;
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
import { TenantInterceptor } from './tenant/interceptors/tenant.interceptor';
import { AuditLogEntity } from './common/audit/audit-log.entity';
import { JobsModule } from './jobs/jobs.module';
import { AuditModule } from './common/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    // Rate limiting with Redis-backed storage
    ScheduleModule.forRoot(),
    // Rate limiting and throttling for security
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useClass: ThrottlerConfigService,
    }),
    // Application modules
    TenantModule,
    CommonModule,
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
    NotificationsModule,
    QueueModule,
    FhirModule,
    AccessControlModule,
    JobsModule,
    StellarModule,
    AuditModule,
    ReportsModule,
    TenantConfigModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: MedicalEmergencyErrorFilter,
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
export class AppModule { }
