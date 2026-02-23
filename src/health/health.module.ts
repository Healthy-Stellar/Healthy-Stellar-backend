import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { PostgresHealthIndicator } from './indicators/postgres.indicator';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { IpfsHealthIndicator } from './indicators/ipfs.indicator';
import { StellarHealthIndicator } from './indicators/stellar.indicator';
import { RedisHealthIndicator } from './indicators/redis.health';
import { IpfsHealthIndicator } from './indicators/ipfs.health';
import { StellarHealthIndicator } from './indicators/stellar.health';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [
    PostgresHealthIndicator,
    RedisHealthIndicator,
    IpfsHealthIndicator,
    StellarHealthIndicator,
  ],
  providers: [RedisHealthIndicator, IpfsHealthIndicator, StellarHealthIndicator],
})
export class HealthModule {}
