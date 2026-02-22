import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { CommonModule } from './common/common.module';
import { PatientModule } from './patients/patients.module';
import { LaboratoryModule } from './laboratory/laboratory.module';
import { DiagnosisModule } from './diagnosis/diagnosis.module';
import { TreatmentPlanningModule } from './treatment-planning/treatment-planning.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { InfectionControlModule } from './infection-control/infection-control.module';
import { TenantModule } from './tenant/tenant.module';
import { DatabaseConfig } from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { ValidationModule } from './common/validation/validation.module';
import { MedicalEmergencyErrorFilter } from './common/errors/medical-emergency-error.filter';
import { MedicalDataValidationPipe } from './common/validation/medical-data.validator.pipe';
import { TenantInterceptor } from './tenant/interceptors/tenant.interceptor';
import { AuditLogEntity } from './common/audit/audit-log.entity';

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
    // Rate limiting and throttling for security
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    // Application modules
    TenantModule,
    CommonModule,
    AuthModule,
    BillingModule,
    MedicalRecordsModule,
    PatientModule,
    LaboratoryModule,
    DiagnosisModule,
    TreatmentPlanningModule,
    PharmacyModule,
    ValidationModule,
    InfectionControlModule,
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
      useClass: MedicalEmergencyErrorFilter
    },
    {
      provide: APP_PIPE,
      useClass: MedicalDataValidationPipe
    }
  ],
})
export class AppModule {}
