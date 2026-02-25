import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health';
import { IpfsHealthIndicator } from './indicators/ipfs.health';
import { StellarHealthIndicator } from './indicators/stellar.health';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';

@Module({
  imports: [TerminusModule, HttpModule, CircuitBreakerModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, IpfsHealthIndicator, StellarHealthIndicator],
})
export class HealthModule {}
