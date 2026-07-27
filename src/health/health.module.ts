import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { DataResidencyModule } from '../data-residency/data-residency.module';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { HealthController } from './health.controller';
import { DetailedHealthIndicator } from './indicators/detailed-health.indicator';
import { IpfsHealthIndicator } from './indicators/ipfs.health';
import { QueueHealthIndicator } from './indicators/queue.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { StellarHealthIndicator } from './indicators/stellar.health';
import { SyntheticProbeIndicator } from './indicators/synthetic-probe.indicator';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    CircuitBreakerModule,
    TypeOrmModule,
    DataResidencyModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.STELLAR_TRANSACTIONS },
      { name: QUEUE_NAMES.IPFS_UPLOADS },
      { name: QUEUE_NAMES.EMAIL_NOTIFICATIONS },
      { name: QUEUE_NAMES.REPORTS },
    ),
  ],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    IpfsHealthIndicator,
    QueueHealthIndicator,
    StellarHealthIndicator,
    DetailedHealthIndicator,
    SyntheticProbeIndicator,
  ],
})
export class HealthModule {}
