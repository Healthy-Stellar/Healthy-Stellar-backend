import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface StreamEvent {
  id: string;
  data: Record<string, string>;
}

/**
 * Redis Streams-backed event log used to replay events a subscriber missed
 * while disconnected. Keyed by (eventType, entityId) pairs, e.g.
 * (SUBSCRIPTION_EVENTS.RECORD_ACCESSED, patientId).
 */
@Injectable()
export class RedisStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisStreamService.name);
  private readonly retentionSeconds = 60 * 60;
  private redis: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: Number(this.configService.get('REDIS_PORT', 6379)),
      password: this.configService.get('REDIS_PASSWORD'),
      db: Number(this.configService.get('REDIS_DB', 0)),
      maxRetriesPerRequest: null,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
  }

  async appendEvent(
    eventType: string,
    entityId: string,
    fields: Record<string, string>,
  ): Promise<string> {
    const key = this.getStreamKey(eventType, entityId);
    const flatFields = Object.entries(fields).flat();
    const streamId = await this.redis.xadd(key, '*', ...flatFields);
    await this.redis.expire(key, this.retentionSeconds);
    return streamId ?? '';
  }

  async replayEvents(
    eventType: string,
    entityId: string,
    lastEventId: string | null,
  ): Promise<StreamEvent[]> {
    const key = this.getStreamKey(eventType, entityId);
    const start = lastEventId ? `(${lastEventId}` : '-';
    const entries = (await this.redis.xrange(key, start, '+')) as [string, string[]][];

    return entries.map(([id, flatFields]) => ({
      id,
      data: this.toFieldMap(flatFields),
    }));
  }

  private toFieldMap(flatFields: string[]): Record<string, string> {
    const data: Record<string, string> = {};
    for (let index = 0; index < flatFields.length; index += 2) {
      data[flatFields[index]] = flatFields[index + 1];
    }
    return data;
  }

  private getStreamKey(eventType: string, entityId: string): string {
    return `subs:stream:${eventType}:${entityId}`;
  }
}
