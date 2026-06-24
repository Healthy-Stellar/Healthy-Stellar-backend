import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
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
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    ConfigModule,
    CircuitBreakerModule,
    MetricsModule,
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
    StellarTracingService,
    StellarTransactionRetryService,
    StellarRetryStoreService,
    StellarTransactionQueueService,
    StellarRecoveryManagerService,
  ],
  exports: [
    StellarFeeService,
    StellarService,
    StellarWithBreakerService,
    StellarTracingService,
    StellarTransactionRetryService,
    StellarTransactionQueueService,
    StellarRecoveryManagerService,
  ],
})
export class StellarModule {}
