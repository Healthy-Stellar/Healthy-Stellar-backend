import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
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
import { EmergencyOperationsModule } from './emergency-operations/emergency-operations.module';
import { AccessControlModule } from './access-control/access-control.module';
import { DatabaseConfig } from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { ValidationModule } from './common/validation/validation.module';
import { MedicalEmergencyErrorFilter } from './common/errors/medical-emergency-error.filter';
import { MedicalDataValidationPipe } from './common/validation/medical-data.validator.pipe';
import { NotificationsModule } from './notifications/notifications.module';
import { QueueModule } from './queues/queue.module';
import { FhirModule } from './fhir/fhir.module';

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
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const baseOptions = {
          ignoreUserAgents: [],
          skipIf: () => false,
          setHeaders: true,
          throttlers: [
            {
              name: 'ip',
              ttl: 60,
              limit: 100,
              getTracker: (req) => req.ip || req.connection?.remoteAddress || 'unknown-ip',
              skipIf: (context) => hasBearerAuthUser(context.switchToHttp().getRequest()),
            },
            {
              name: 'user',
              ttl: 60,
              limit: 200,
              getTracker: (req) => getUserTrackerFromRequest(req),
              skipIf: (context) => !hasBearerAuthUser(context.switchToHttp().getRequest()),
            },
          ],
          storage: redisUrl ? new ThrottlerStorageRedisService(redisUrl) : undefined,
        } as any;

        return baseOptions;
      },
    }),
    // Application modules
    CommonModule,
    AuthModule,
    BillingModule,
    MedicalRecordsModule,
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
    StellarModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
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
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
