import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheInvalidationEvent, CacheInvalidationEventType } from './cache-invalidation.enum';

const CACHE_INVALIDATION_CHANNEL = 'cache:invalidation';

@Injectable()
export class CacheInvalidationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private redisPublisher: Redis;
  private redisSubscriber: Redis;
  private subscribers: Set<(event: CacheInvalidationEvent) => void> = new Set();
  private instance: string;

  constructor(private readonly configService: ConfigService) {
    this.instance = `${process.env.HOSTNAME || 'default'}-${process.pid}`;
  }

  async onModuleInit(): Promise<void> {
    // Initialize Redis clients for pub/sub
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    if (redisUrl) {
      this.redisPublisher = new Redis(redisUrl);
      this.redisSubscriber = new Redis(redisUrl);
    } else {
      this.redisPublisher = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });
      this.redisSubscriber = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });
    }

    this.redisPublisher.on('error', (err) => {
      this.logger.error('Redis publisher error:', err);
    });

    this.redisSubscriber.on('error', (err) => {
      this.logger.error('Redis subscriber error:', err);
    });

    // Subscribe to cache invalidation channel
    this.redisSubscriber.on('message', (channel: string, message: string) => {
      if (channel === CACHE_INVALIDATION_CHANNEL) {
        try {
          const event: CacheInvalidationEvent = JSON.parse(message);
          // Skip events from this instance (avoid processing own events)
          if (event.source !== this.instance) {
            this.logger.debug(`Received cache invalidation event: ${event.type} for ${event.key}`);
            this.notifySubscribers(event);
          }
        } catch (error) {
          this.logger.error('Failed to parse cache invalidation event:', error);
        }
      }
    });

    await this.redisSubscriber.subscribe(CACHE_INVALIDATION_CHANNEL);
    this.logger.log(
      `Cache invalidation service initialized (instance: ${this.instance}) and subscribed to ${CACHE_INVALIDATION_CHANNEL}`,
    );
  }

  /**
   * Publish a cache invalidation event to all instances
   */
  async publishInvalidation(
    type: CacheInvalidationEventType,
    tenantId: string,
    key: string,
  ): Promise<void> {
    const event: CacheInvalidationEvent = {
      type,
      tenantId,
      key,
      timestamp: Date.now(),
      source: this.instance,
    };

    try {
      await this.redisPublisher.publish(
        CACHE_INVALIDATION_CHANNEL,
        JSON.stringify(event),
      );
      this.logger.debug(
        `Published cache invalidation event: ${type} for ${key} on tenant ${tenantId}`,
      );
    } catch (error) {
      this.logger.error('Failed to publish cache invalidation event:', error);
      throw error;
    }
  }

  /**
   * Subscribe to cache invalidation events
   * Returns unsubscribe function
   */
  subscribe(callback: (event: CacheInvalidationEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of a cache invalidation event
   */
  private notifySubscribers(event: CacheInvalidationEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Error in cache invalidation subscriber:', error);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisPublisher.quit();
    await this.redisSubscriber.quit();
    this.logger.log('Cache invalidation service cleaned up');
  }
}
