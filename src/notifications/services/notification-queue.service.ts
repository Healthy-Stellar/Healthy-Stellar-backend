import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { NotificationEvent } from '../interfaces/notification-event.interface';

/** Minimal envelope stored in Redis — no metadata/PII */
interface StoredNotification {
  eventType: NotificationEvent['eventType'];
  actorId: string;
  resourceId: string;
  timestamp: Date;
}

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
    // Store only the fields needed to reconstruct context — never metadata
    const stored: StoredNotification = {
      eventType: event.eventType,
      actorId: event.actorId,
      resourceId: event.resourceId,
      timestamp: event.timestamp,
    };

    await this.redis
      .multi()
      .lpush(key, JSON.stringify(stored))
      .ltrim(key, 0, this.MAX_EVENTS - 1)
      .expire(key, this.TTL_SECONDS)
      .exec();
  }

  async getQueuedEvents(userId: string): Promise<StoredNotification[]> {
    const key = `notifications:${userId}`;
    const events = await this.redis.lrange(key, 0, -1);
    await this.redis.del(key);
    return events.map((e) => JSON.parse(e)).reverse();
  }
}
