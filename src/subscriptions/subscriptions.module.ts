import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SubscriptionsResolver } from './subscriptions.resolver';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionAuthGuard } from './guards/subscription-auth.guard';
import { SubscriptionRateLimiterService } from './services/subscription-rate-limiter.service';
import { PubSubModule } from '../pubsub/pubsub.module';
import {
  SubscriptionsActiveGauge,
  SubscriptionsRejectedCounter,
  SubscriptionsTimedOutCounter,
} from '../metrics/custom-metrics.service';

@Module({
  imports: [
    PubSubModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    SubscriptionsResolver,
    SubscriptionsService,
    SubscriptionAuthGuard,
    SubscriptionRateLimiterService,
    SubscriptionsActiveGauge,
    SubscriptionsRejectedCounter,
    SubscriptionsTimedOutCounter,
  ],
  exports: [SubscriptionsService, SubscriptionRateLimiterService],
})
export class SubscriptionsModule {}
