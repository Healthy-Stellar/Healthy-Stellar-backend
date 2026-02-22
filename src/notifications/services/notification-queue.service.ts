import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { NotificationEvent } from '../interfaces/notification-event.interface';

@Injectable()
export class NotificationQueueService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private readonly MAX_EVENTS = 50;
  private readonly TTL_SECONDS = 86400; // 24 hours

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async queueEvent(userId: string, event: NotificationEvent): Promise<void> {
    const key = `notifications:${userId}`;
    const eventData = JSON.stringify(event);
    
    await this.redis
      .multi()
      .lpush(key, eventData)
      .ltrim(key, 0, this.MAX_EVENTS - 1)
      .expire(key, this.TTL_SECONDS)
      .exec();
  }

  async getQueuedEvents(userId: string): Promise<NotificationEvent[]> {
    const key = `notifications:${userId}`;
    const events = await this.redis.lrange(key, 0, -1);
    await this.redis.del(key);
    return events.map(e => JSON.parse(e)).reverse();
  }
}
