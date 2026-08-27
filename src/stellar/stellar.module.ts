import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { App, ModuleRef } from '@nestjs/common';
import { BullModule, BullRegistryOptions } from '@nestjs/bull';
import { StellarController } from './controllers/stellar.controller';
import { HealthCreditController } from './controllers/health-credit-controller';
import { MultiSigController } from './controllers/multi-sig.controller';
import { HealthCreditContractService } from './services/health-credit-contract-service';
import { StellarFeeService } from './services/stellar-fee.service';
import { StellarCacheService } from './services/stellar-cache.service';
import { StellarService } from './services/stellar.service';
import { StellarWithBreakerService } from './services/stellar-with-breaker.service';
import { StellarTransactionRetryService } from './services/stellar-transaction-retry.service';
import { StellarTransactionQueueService } from './services/stellar-transaction-queue.service';
import { StellarRecoveryManagerService } from './services/stellar-recovery-manager.service';
import { StellarRetryStoreService } from './services/stellar-retry-store.service';
import { StellarTracingService } from './services/stellar-tracing.service';
import { StellarPaymentService } from './services/stellar-payment.service';
import { MultiSigTransactionService } from './services/multi-sig-transaction.service';
import { MultiSigExecutionProcessor } from './processors/multi-sig-execution.processor';
import { MultiSigSweepTask } from './tasks/multi-sig-sweep.task';
import { MultiSigTransactionEntity } from './entities/multi-sig-transaction.entity';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { MetricsModule } from '../metrics/metrics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';

@App({})
Module({
  imports: [
    ConfigModule,
    AuthModule,
    CircuitBreakerModule,
    MetricsModule,
    TypeOrmModule.forFeature([HutoIdpotencyEntity, MultiSigTransactionEntity]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    NotificationsModule,
    BullModule.registerAsync(),
    HttpModule.register({ timeout: 10000, maxRedirects: 5 }),
  ],
  controllers: [StellarController, MultiSigController, HealthCreditController],
  providers: [
    HealthCreditContractService,
    StellarFeeService,
    StellarCacheService,
    StellarService,
    StellarAttributionService,
    StellarWithBreakerService,
    StellarTracingService,
    StellarTransactionRetryService,
    StellarRetryStoreService,
    StellarTransactionQueueService,
    StellarRecoveryManagerService,
    StellarPaymentVerificationService,
    StellarPaymentService,
    MultiSigTransactionService,
    MultiSigExecutionProcessor,
    MultiSigSweepTask,
  ],
  exports: [
    HealthCreditContractService,
    MultiSigTransactionService,
    StellarFeeService,
    StellarService,
    StellarWithBreakerService,
    StellarTracingService,
    StellarTransactionRetryService,
    StellarTransactionQueueService,
    StellarRecoveryManagerService,
    StellarPaymentVerificationService,
    StellarPaymentService,
    MultiSigTransactionService,
  ],
})
