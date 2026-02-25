import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { StellarController } from './controllers/stellar.controller';
import { StellarFeeService } from './services/stellar-fee.service';
import { StellarCacheService } from './services/stellar-cache.service';
import { StellarService } from './services/stellar.service';
import { StellarWithBreakerService } from './services/stellar-with-breaker.service';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';

@Module({
  imports: [
    ConfigModule,
    CircuitBreakerModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [StellarController],
  providers: [StellarFeeService, StellarCacheService, StellarService, StellarWithBreakerService],
  exports: [StellarFeeService, StellarService, StellarWithBreakerService],
})
export class StellarModule {}
