import {
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

type StreamEntry = [string, string[]];

@Injectable()
export class GraphqlPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly streamRetentionSeconds = 60 * 60;
  private readonly maxConnectionsPerUser = 5;

  private publisherRedis: Redis;
  private subscriberRedis: Redis;
  private streamRedis: Redis;
  private pubSub: RedisPubSub;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.publisherRedis = this.buildRedisClient();
    this.subscriberRedis = this.buildRedisClient();
    this.streamRedis = this.buildRedisClient();

    this.pubSub = new RedisPubSub({
      publisher: this.publisherRedis,
      subscriber: this.subscriberRedis,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.publisherRedis?.quit(),
      this.subscriberRedis?.quit(),
      this.streamRedis?.quit(),
    ]);
  }

  generateConnectionId(): string {
    return randomUUID();
  }

  async registerConnection(userId: string, connectionId: string): Promise<number> {
    const key = this.getConnectionKey(userId);

    await this.streamRedis.sadd(key, connectionId);
    await this.streamRedis.expire(key, this.streamRetentionSeconds);

    const connectionCount = await this.streamRedis.scard(key);
    if (connectionCount > this.maxConnectionsPerUser) {
      await this.streamRedis.srem(key, connectionId);
      throw new ForbiddenException(
        `Subscription connection limit exceeded (${this.maxConnectionsPerUser})`,
      );
    }

    return connectionCount;
  }

  async unregisterConnection(userId: string, connectionId: string): Promise<void> {
    const key = this.getConnectionKey(userId);
    await this.streamRedis.srem(key, connectionId);
  }

  async publishRecordAccessed(
    patientId: string,
    event: Record<string, any>,
  ): Promise<{ eventId: string }> {
    return this.publishWithReplay(
      this.getPatientTrigger('recordAccessed', patientId),
      this.getPatientStreamKey('recordAccessed', patientId),
      'recordAccessed',
      event,
    );
  }

  async publishAccessGranted(
    patientId: string,
    event: Record<string, any>,
  ): Promise<{ eventId: string }> {
    return this.publishWithReplay(
      this.getPatientTrigger('accessGranted', patientId),
      this.getPatientStreamKey('accessGranted', patientId),
      'accessGranted',
      event,
    );
  }

  async publishAccessRevoked(
    patientId: string,
    event: Record<string, any>,
  ): Promise<{ eventId: string }> {
    return this.publishWithReplay(
      this.getPatientTrigger('accessRevoked', patientId),
      this.getPatientStreamKey('accessRevoked', patientId),
      'accessRevoked',
      event,
    );
  }

  async publishRecordUploaded(
    patientId: string,
    event: Record<string, any>,
  ): Promise<{ eventId: string }> {
    return this.publishWithReplay(
      this.getPatientTrigger('recordUploaded', patientId),
      this.getPatientStreamKey('recordUploaded', patientId),
      'recordUploaded',
      event,
    );
  }

  async publishJobStatusUpdated(
    jobId: string,
    event: Record<string, any>,
  ): Promise<{ eventId: string }> {
    return this.publishWithReplay(
      this.getJobTrigger(jobId),
      this.getJobStreamKey(jobId),
      'jobStatusUpdated',
      event,
    );
  }

  async recordAccessedIterator(patientId: string, sinceEventId?: string) {
    return this.createReplayableIterator(
      this.getPatientTrigger('recordAccessed', patientId),
      this.getPatientStreamKey('recordAccessed', patientId),
      'recordAccessed',
      sinceEventId,
    );
  }

  async accessGrantedIterator(patientId: string, sinceEventId?: string) {
    return this.createReplayableIterator(
      this.getPatientTrigger('accessGranted', patientId),
      this.getPatientStreamKey('accessGranted', patientId),
      'accessGranted',
      sinceEventId,
    );
  }

  async accessRevokedIterator(patientId: string, sinceEventId?: string) {
    return this.createReplayableIterator(
      this.getPatientTrigger('accessRevoked', patientId),
      this.getPatientStreamKey('accessRevoked', patientId),
      'accessRevoked',
      sinceEventId,
    );
  }

  async recordUploadedIterator(patientId: string, sinceEventId?: string) {
    return this.createReplayableIterator(
      this.getPatientTrigger('recordUploaded', patientId),
      this.getPatientStreamKey('recordUploaded', patientId),
      'recordUploaded',
      sinceEventId,
    );
  }

  async jobStatusUpdatedIterator(jobId: string, sinceEventId?: string) {
    return this.createReplayableIterator(
      this.getJobTrigger(jobId),
      this.getJobStreamKey(jobId),
      'jobStatusUpdated',
      sinceEventId,
    );
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

  private async publishWithReplay(
    trigger: string,
    streamKey: string,
    fieldName: string,
    payload: Record<string, any>,
  ): Promise<{ eventId: string }> {
    if (!this.pubSub || !this.streamRedis) {
      throw new ServiceUnavailableException('GraphQL PubSub is not initialized');
    }

    const streamPayload = JSON.stringify({ [fieldName]: payload });
    const streamId = await this.streamRedis.xadd(streamKey, '*', 'payload', streamPayload);
    await this.streamRedis.expire(streamKey, this.streamRetentionSeconds);

    await this.pubSub.publish(trigger, {
      [fieldName]: {
        ...payload,
        eventId: streamId,
      },
    });

    return { eventId: streamId };
  }

  private async createReplayableIterator(
    trigger: string,
    streamKey: string,
    fieldName: string,
    sinceEventId?: string,
  ): Promise<AsyncIterable<any>> {
    if (!this.pubSub || !this.streamRedis) {
      throw new ServiceUnavailableException('GraphQL PubSub is not initialized');
    }

    const liveIterator = this.pubSub.asyncIterator(trigger);
    const replayPayloads = await this.readReplayPayloads(streamKey, fieldName, sinceEventId);

    return (async function* () {
      for (const replayPayload of replayPayloads) {
        yield replayPayload;
      }

      while (true) {
        const next = await liveIterator.next();
        if (next.done) {
          return;
        }
        yield next.value;
      }
    })();
  }

  private async readReplayPayloads(
    streamKey: string,
    fieldName: string,
    sinceEventId?: string,
  ): Promise<Record<string, any>[]> {
    if (!sinceEventId) {
      return [];
    }

    const entries = (await this.streamRedis.xrange(
      streamKey,
      `(${sinceEventId}`,
      '+',
      'COUNT',
      2000,
    )) as StreamEntry[];

    return entries
      .map(([streamId, fields]) => {
        const payloadJson = this.getFieldValue(fields, 'payload');
        if (!payloadJson) {
          return null;
        }

        try {
          const parsed = JSON.parse(payloadJson);
          const eventPayload = parsed[fieldName];
          if (!eventPayload) {
            return null;
          }

          return {
            [fieldName]: {
              ...eventPayload,
              eventId: streamId,
            },
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  private getFieldValue(fields: string[], fieldName: string): string | null {
    for (let index = 0; index < fields.length; index += 2) {
      if (fields[index] === fieldName) {
        return fields[index + 1] ?? null;
      }
    }
    return null;
  }

  private getConnectionKey(userId: string): string {
    return `gql:subs:connections:${userId}`;
  }

  private getPatientTrigger(eventName: string, patientId: string): string {
    return `gql:subs:${eventName}:patient:${patientId}`;
  }

  private getJobTrigger(jobId: string): string {
    return `gql:subs:jobStatusUpdated:job:${jobId}`;
  }

  private getPatientStreamKey(eventName: string, patientId: string): string {
    return `gql:subs:stream:${eventName}:patient:${patientId}`;
  }

  private getJobStreamKey(jobId: string): string {
    return `gql:subs:stream:jobStatusUpdated:job:${jobId}`;
  }
}
