import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health';
import { IpfsHealthIndicator } from './indicators/ipfs.health';
import { StellarHealthIndicator } from './indicators/stellar.health';
import { DetailedHealthIndicator } from './indicators/detailed-health.indicator';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { DataResidencyModule } from '../data-residency/data-residency.module';
import { QUEUE_NAMES } from '../queues/queue.constants';

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
    StellarHealthIndicator,
    DetailedHealthIndicator,
  ],
})
export class HealthModule {}
