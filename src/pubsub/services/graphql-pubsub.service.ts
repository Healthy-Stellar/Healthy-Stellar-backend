import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { SessionRevocationService } from '../../auth/services/session-revocation.service';

type StreamEntry = [string, string[]];

/** Tracks every live async iterator so we can terminate it on revocation. */
interface TrackedIterator {
  sessionId: string;
  userId: string;
  iterator: AsyncIterator<any>;
  /** Calling this resolves the iterator with done=true. */
  terminate: () => void;
}

@Injectable()
export class GraphqlPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GraphqlPubSubService.name);
  private readonly streamRetentionSeconds = 60 * 60;
  private readonly maxConnectionsPerUser = 5;

  private publisherRedis: Redis;
  private subscriberRedis: Redis;
  private streamRedis: Redis;
  /** Dedicated subscriber client for session-revocation channels. */
  private revocationRedis: Redis;
  private pubSub: RedisPubSub;

  /** All live iterators keyed by a random handle. */
  private readonly trackedIterators = new Map<string, TrackedIterator>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.publisherRedis = this.buildRedisClient();
    this.subscriberRedis = this.buildRedisClient();
    this.streamRedis = this.buildRedisClient();
    this.revocationRedis = this.buildRedisClient();

    this.pubSub = new RedisPubSub({
      publisher: this.publisherRedis,
      subscriber: this.subscriberRedis,
    });

    this.subscribeToRevocationChannels();
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.publisherRedis?.quit(),
      this.subscriberRedis?.quit(),
      this.streamRedis?.quit(),
      this.revocationRedis?.quit(),
    ]);
  }

  generateConnectionId(): string {
    return randomUUID();
  }

  // ── Revocation propagation ─────────────────────────────────────────────────

  /**
   * Subscribe to Redis revocation channels published by SessionRevocationService.
   * When a message arrives, all tracked iterators for that session/user are
   * terminated so the WebSocket subscription ends immediately.
   */
  private subscribeToRevocationChannels(): void {
    this.revocationRedis.psubscribe(
      `${SessionRevocationService.SESSION_REVOKED_CHANNEL}:*`,
      `${SessionRevocationService.USER_SESSIONS_REVOKED_CHANNEL}:*`,
      (err) => {
        if (err) {
          this.logger.error(`Failed to subscribe to revocation channels: ${err.message}`);
        }
      },
    );

    this.revocationRedis.on('pmessage', (_pattern: string, channel: string, _message: string) => {
      if (channel.startsWith(`${SessionRevocationService.SESSION_REVOKED_CHANNEL}:`)) {
        const sessionId = channel.slice(
          `${SessionRevocationService.SESSION_REVOKED_CHANNEL}:`.length,
        );
        this.terminateIteratorsForSession(sessionId);
      } else if (
        channel.startsWith(`${SessionRevocationService.USER_SESSIONS_REVOKED_CHANNEL}:`)
      ) {
        const userId = channel.slice(
          `${SessionRevocationService.USER_SESSIONS_REVOKED_CHANNEL}:`.length,
        );
        this.terminateIteratorsForUser(userId);
      }
    });
  }

  private terminateIteratorsForSession(sessionId: string): void {
    let count = 0;
    for (const [handle, tracked] of this.trackedIterators) {
      if (tracked.sessionId === sessionId) {
        tracked.terminate();
        this.trackedIterators.delete(handle);
        count++;
      }
    }
    if (count > 0) {
      this.logger.log(
        `Terminated ${count} subscription iterator(s) for revoked session ${sessionId}`,
      );
    }
  }

  private terminateIteratorsForUser(userId: string): void {
    let count = 0;
    for (const [handle, tracked] of this.trackedIterators) {
      if (tracked.userId === userId) {
        tracked.terminate();
        this.trackedIterators.delete(handle);
        count++;
      }
    }
    if (count > 0) {
      this.logger.log(
        `Terminated ${count} subscription iterator(s) for all revoked sessions of user ${userId}`,
      );
    }
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

  async recordAccessedIterator(patientId: string, sinceEventId?: string, sessionId?: string, userId?: string) {
    return this.createReplayableIterator(
      this.getPatientTrigger('recordAccessed', patientId),
      this.getPatientStreamKey('recordAccessed', patientId),
      'recordAccessed',
      sinceEventId,
      sessionId,
      userId,
    );
  }

  async accessGrantedIterator(patientId: string, sinceEventId?: string, sessionId?: string, userId?: string) {
    return this.createReplayableIterator(
      this.getPatientTrigger('accessGranted', patientId),
      this.getPatientStreamKey('accessGranted', patientId),
      'accessGranted',
      sinceEventId,
      sessionId,
      userId,
    );
  }

  async accessRevokedIterator(patientId: string, sinceEventId?: string, sessionId?: string, userId?: string) {
    return this.createReplayableIterator(
      this.getPatientTrigger('accessRevoked', patientId),
      this.getPatientStreamKey('accessRevoked', patientId),
      'accessRevoked',
      sinceEventId,
      sessionId,
      userId,
    );
  }

  async recordUploadedIterator(patientId: string, sinceEventId?: string, sessionId?: string, userId?: string) {
    return this.createReplayableIterator(
      this.getPatientTrigger('recordUploaded', patientId),
      this.getPatientStreamKey('recordUploaded', patientId),
      'recordUploaded',
      sinceEventId,
      sessionId,
      userId,
    );
  }

  async jobStatusUpdatedIterator(jobId: string, sinceEventId?: string, sessionId?: string, userId?: string) {
    return this.createReplayableIterator(
      this.getJobTrigger(jobId),
      this.getJobStreamKey(jobId),
      'jobStatusUpdated',
      sinceEventId,
      sessionId,
      userId,
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
    sessionId?: string,
    userId?: string,
  ): Promise<AsyncIterable<any>> {
    if (!this.pubSub || !this.streamRedis) {
      throw new ServiceUnavailableException('GraphQL PubSub is not initialized');
    }

    const liveIterator = this.pubSub.asyncIterator(trigger);
    const replayPayloads = await this.readReplayPayloads(streamKey, fieldName, sinceEventId);

    // Termination mechanism: a promise that resolves when revocation fires.
    let terminateFn: () => void;
    const terminationPromise = new Promise<void>((resolve) => {
      terminateFn = resolve;
    });

    const handle = randomUUID();
    if (sessionId && userId) {
      this.trackedIterators.set(handle, {
        sessionId,
        userId,
        iterator: liveIterator,
        terminate: terminateFn!,
      });
    }

    const trackedIterators = this.trackedIterators;

    return (async function* () {
      try {
        for (const replayPayload of replayPayloads) {
          yield replayPayload;
        }

        while (true) {
          // Race: next live event vs. revocation signal.
          const nextPromise = liveIterator.next();
          const raced = await Promise.race([
            nextPromise.then((v) => ({ kind: 'value' as const, value: v })),
            terminationPromise.then(() => ({ kind: 'terminated' as const })),
          ]);

          if (raced.kind === 'terminated') {
            // Session was revoked — close the iterator cleanly.
            await liveIterator.return?.();
            return;
          }

          if (raced.value.done) {
            return;
          }

          yield raced.value.value;
        }
      } finally {
        trackedIterators.delete(handle);
        await liveIterator.return?.();
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
