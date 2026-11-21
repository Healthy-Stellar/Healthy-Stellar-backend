import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

export const SUBSCRIPTION_EVENTS = {
  RECORD_ACCESSED: 'recordAccessed',
  ACCESS_GRANTED: 'accessGranted',
  ACCESS_REVOKED: 'accessRevoked',
  RECORD_UPLOADED: 'recordUploaded',
  JOB_STATUS_UPDATED: 'jobStatusUpdated',
} as const;

export type SubscriptionEventName = (typeof SUBSCRIPTION_EVENTS)[keyof typeof SUBSCRIPTION_EVENTS];

/**
 * Generic, topic-based Redis pub/sub used by SubscriptionsService. Distinct
 * from GraphqlPubSubService, which bakes in patient/job-specific triggers,
 * replay and revocation handling for the `src/graphql` subscription stack.
 */
@Injectable()
export class PubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PubSubService.name);
  private publisherClient: Redis;
  private subscriberClient: Redis;
  private pubSub: RedisPubSub;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.publisherClient = this.buildRedisClient();
    this.subscriberClient = this.buildRedisClient();
    this.pubSub = new RedisPubSub({
      publisher: this.publisherClient,
      subscriber: this.subscriberClient,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.publisherClient?.quit(), this.subscriberClient?.quit()]);
  }

  asyncIterator<T>(topic: string): AsyncIterator<T> {
    return this.pubSub.asyncIterator<T>(topic);
  }

  async publish(topic: string, payload: unknown): Promise<void> {
    await this.pubSub.publish(topic, payload);
  }

  private buildRedisClient(): Redis {
    return new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: Number(this.configService.get('REDIS_PORT', 6379)),
      password: this.configService.get('REDIS_PASSWORD'),
      db: Number(this.configService.get('REDIS_DB', 0)),
      maxRetriesPerRequest: null,
    });
  }
}
