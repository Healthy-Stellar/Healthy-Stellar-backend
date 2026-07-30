 feat/idempotency-ttl-cleanup
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyKey } from './idempotency-key.entity';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKey])],
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpIdempotencyEntity } from './idempotency.entity';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([HttpIdempotencyEntity]),
  ],
  providers: [IdempotencyInterceptor, IdempotencyCleanupService],
  exports: [IdempotencyInterceptor, IdempotencyCleanupService],
 main
})
export class IdempotencyModule {}
