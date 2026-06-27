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
import { StellarTracingService } from './services/stellar-tracing.service';
import { MultiSigTransactionService } from './services/multi-sig-transaction.service';
import { MultiSigTransactionEntity } from './entities/multi-sig-transaction.entity';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { MetricsModule } from '../metrics/metrics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule,
    CircuitBreakerModule,
    MetricsModule,
    TypeOrmModule.forFeature([HttpIdempotencyEntity, MultiSigTransactionEntity]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    NotificationsModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [StellarController, MultiSigController],
  providers: [
    StellarFeeService,
    StellarCacheService,
    StellarService,
    StellarWithBreakerService,
    StellarTracingService,
    StellarTransactionRetryService,
    StellarRetryStoreService,
    StellarTransactionQueueService,
    StellarRecoveryManagerService,
    StellarPaymentVerificationService,
    MultiSigTransactionService,
  ],
  exports: [
    MultiSigTransactionService,
    
    StellarFeeService,
    StellarService,
    StellarWithBreakerService,
    StellarTracingService,
    StellarTransactionRetryService,
    StellarTransactionQueueService,
    StellarRecoveryManagerService,
    StellarPaymentVerificationService,
    MultiSigTransactionService,
  ],
})
export class StellarModule {}

