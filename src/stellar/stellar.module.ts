import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { StellarController } from './controllers/stellar.controller';
import { StellarFeeService } from './services/stellar-fee.service';
import { StellarCacheService } from './services/stellar-cache.service';
import { StellarService } from './services/stellar.service';
import { StellarWithBreakerService } from './services/stellar-with-breaker.service';
import { StellarTransactionRetryService } from './services/stellar-transaction-retry.service';
import { StellarTransactionQueueService } from './services/stellar-transaction-queue.service';
import { StellarRecoveryManagerService } from './services/stellar-recovery-manager.service';
import { StellarRetryStoreService } from './services/stellar-retry-store.service';
import { StellarPaymentVerificationService } from './services/stellar-payment-verification.service';
import { HttpIdempotencyEntity } from '../idempotency/idempotency.entity';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    ConfigModule,
    CircuitBreakerModule,
    MetricsModule,
    TypeOrmModule.forFeature([HttpIdempotencyEntity]),
    EventEmitterModule.forRoot(),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [StellarController],
  providers: [
    StellarFeeService,
    StellarCacheService,
    StellarService,
    StellarWithBreakerService,
    StellarTransactionRetryService,
    StellarRetryStoreService,
    StellarTransactionQueueService,
    StellarRecoveryManagerService,
    StellarPaymentVerificationService,
  ],
  exports: [
    StellarFeeService,
    StellarService,
    StellarWithBreakerService,
    StellarTransactionRetryService,
    StellarTransactionQueueService,
    StellarRecoveryManagerService,
    StellarPaymentVerificationService,
  ],
})
export class StellarModule {}
