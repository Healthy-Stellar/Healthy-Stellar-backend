import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpIdempotencyEntity } from './idempotency.entity';
import { IdempotencyKey } from './idempotency-key.entity';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([HttpIdempotencyEntity, IdempotencyKey]),
  ],
  providers: [IdempotencyInterceptor, IdempotencyCleanupService, IdempotencyService],
  exports: [IdempotencyInterceptor, IdempotencyCleanupService, IdempotencyService],
})
export class IdempotencyModule {}
