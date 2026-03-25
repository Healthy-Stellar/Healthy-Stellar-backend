import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health';
import { IpfsHealthIndicator } from './indicators/ipfs.health';
import { StellarHealthIndicator } from './indicators/stellar.health';
 feat/detailed-health-endpoint
import { DetailedHealthIndicator } from './indicators/detailed-health.indicator';
import { QUEUE_NAMES } from '../queues/queue.constants';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.STELLAR_TRANSACTIONS },
      { name: QUEUE_NAMES.IPFS_UPLOADS },
      { name: QUEUE_NAMES.EMAIL_NOTIFICATIONS },
    ),
  ],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    IpfsHealthIndicator,
    StellarHealthIndicator,
    DetailedHealthIndicator,
  ],
=======
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';

@Module({
  imports: [TerminusModule, HttpModule, CircuitBreakerModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, IpfsHealthIndicator, StellarHealthIndicator],
 main
})
export class HealthModule {}
