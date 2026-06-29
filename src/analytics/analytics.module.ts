import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-ioredis';

import { User } from '../auth/entities/user.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { StellarTransaction } from './entities/stellar-transaction.entity';
import { Patient } from '../patients/entities/patient.entity';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsCohortsController } from './analytics-cohorts.controller';
import { AnalyticsService } from './analytics.service';
import { CohortQueryService } from './cohort-query.service';
import { CohortReportsService } from './cohort-reports.service';
import { TenantModule } from '../tenant/tenant.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, MedicalRecord, AccessGrant, StellarTransaction, Patient]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        store: redisStore,
        host: config.get('REDIS_HOST', 'localhost'),
        port: config.get<number>('REDIS_PORT', 6379),
        password: config.get('REDIS_PASSWORD'),
        ttl: 300,
        max: 500,
      }),
    }),
    TenantModule,
    DatabaseModule,
  ],
  controllers: [AnalyticsController, AnalyticsCohortsController],
  providers: [AnalyticsService, CohortQueryService, CohortReportsService],
  exports: [AnalyticsService, CohortQueryService, CohortReportsService],
})
export class AnalyticsModule {}
