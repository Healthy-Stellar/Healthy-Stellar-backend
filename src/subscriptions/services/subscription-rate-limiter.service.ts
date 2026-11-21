import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Gauge, Counter } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

export interface SubscriptionTracker {
  connectionId: string;
  userId: string;
  subscriptionType: string;
  startedAt: Date;
  lastActivityAt: Date;
  /** Resolve function to trigger early termination */
  terminate: () => void;
}

@Injectable()
export class SubscriptionRateLimiterService implements OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionRateLimiterService.name);

  /** Max subscriptions allowed per connection (WebSocket) */
  private readonly maxSubscriptionsPerConnection: number;

  /** Idle timeout in ms — subscription with no activity is closed */
  private readonly idleTimeoutMs: number;

  /** How often the idle sweeper runs */
  private readonly sweepIntervalMs: number;

  /** Per-connection subscription count: connectionId -> Set<subscriptionHandle> */
  private readonly connectionSubscriptions = new Map<string, Set<string>>();

  /** All tracked subscriptions keyed by handle */
  private readonly tracked = new Map<string, SubscriptionTracker>();

  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    configService: ConfigService,
    @InjectMetric('subscriptions_active')
    private readonly activeGauge: Gauge<string>,
    @InjectMetric('subscriptions_rejected_total')
    private readonly rejectedCounter: Counter<string>,
    @InjectMetric('subscriptions_timedout_total')
    private readonly timedOutCounter: Counter<string>,
  ) {
    this.maxSubscriptionsPerConnection =
      configService.get<number>('SUBSCRIPTIONS_MAX_PER_CONNECTION') ?? 10;
    this.idleTimeoutMs =
      configService.get<number>('SUBSCRIPTIONS_IDLE_TIMEOUT_MS') ?? 5 * 60 * 1000; // 5 min
    this.sweepIntervalMs =
      configService.get<number>('SUBSCRIPTIONS_SWEEP_INTERVAL_MS') ?? 30_000; // 30s

    this.sweepTimer = setInterval(() => this.sweepIdleSubscriptions(), this.sweepIntervalMs);
    this.logger.log(
      `Subscription rate limiter initialized: max=${this.maxSubscriptionsPerConnection}/conn, idleTimeout=${this.idleTimeoutMs}ms`,
    );
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }


  /**
   * Register a new subscription. Throws if the per-connection limit would be exceeded.
   */
  registerSubscription(
    userId: string,
    connectionId: string,
    subscriptionType: string,
    terminate: () => void,
  ): string {
    const handle = `${connectionId}:${subscriptionType}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    // Check per-connection limit
    let connSet = this.connectionSubscriptions.get(connectionId);
    if (!connSet) {
      connSet = new Set();
      this.connectionSubscriptions.set(connectionId, connSet);
    }

    if (connSet.size >= this.maxSubscriptionsPerConnection) {
      this.rejectedCounter.inc({ connection_id: connectionId, reason: 'per_connection_limit' });
      this.logger.warn(
        `Subscription rejected for connection ${connectionId}: limit of ${this.maxSubscriptionsPerConnection} reached`,
      );
      throw new Error(
        `Subscription limit reached. Maximum ${this.maxSubscriptionsPerConnection} concurrent subscriptions per connection.`,
      );
    }

    connSet.add(handle);

    this.tracked.set(handle, {
      connectionId,
      userId,
      subscriptionType,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      terminate,
    });

    this.activeGauge.inc({ connection_id: connectionId });

    this.logger.log(
      `Subscription registered: handle=${handle} user=${userId} type=${subscriptionType} conn=${connectionId}`,
    );

    return handle;
  }

  /**
   * Unregister a subscription (called on normal completion or error).
   */
  unregisterSubscription(handle: string): void {
    const tracker = this.tracked.get(handle);
    if (!tracker) return;

    const connSet = this.connectionSubscriptions.get(tracker.connectionId);
    if (connSet) {
      connSet.delete(handle);
      if (connSet.size === 0) {
        this.connectionSubscriptions.delete(tracker.connectionId);
      }
    }

    this.tracked.delete(handle);
    this.activeGauge.dec({ connection_id: tracker.connectionId });
  }

  /**
   * Called to signal client activity.
   */
  updateActivity(handle: string): void {
    const tracker = this.tracked.get(handle);
    if (tracker) {
      tracker.lastActivityAt = new Date();
    }
  }

  /**
   * Sweep idle subscriptions and terminate them.
   */
  private sweepIdleSubscriptions(): void {
    const now = Date.now();
    let timedOut = 0;

    for (const [handle, tracker] of this.tracked.entries()) {
      const idleTime = now - tracker.lastActivityAt.getTime();
      if (idleTime >= this.idleTimeoutMs) {
        this.logger.warn(
          `Subscription timed out: handle=${handle} user=${tracker.userId} type=${tracker.subscriptionType} idleMs=${idleTime}`,
        );
        this.timedOutCounter.inc({
          connection_id: tracker.connectionId,
          subscription_type: tracker.subscriptionType,
        });
        tracker.terminate();
        this.unregisterSubscription(handle);
        timedOut++;
      }
    }

    if (timedOut > 0) {
      this.logger.log(`Idle sweep: terminated ${timedOut} idle subscription(s)`);
    }
  }

  /**
   * Clean up all subscriptions for a given connection (on disconnect).
   */
  cleanupConnection(connectionId: string): number {
    let count = 0;
    for (const [handle, tracker] of this.tracked.entries()) {
      if (tracker.connectionId === connectionId) {
        tracker.terminate();
        this.tracked.delete(handle);
        this.activeGauge.dec({ connection_id: connectionId });
        count++;
      }
    }
    this.connectionSubscriptions.delete(connectionId);
    if (count > 0) {
      this.logger.log(`Cleaned up ${count} subscription(s) for connection ${connectionId}`);
    }
    return count;
  }

  /** Get current stats for health/metrics */
  getStats(): {
    totalActive: number;
    perConnection: Record<string, number>;
  } {
    const perConnection: Record<string, number> = {};
    for (const [connId, set] of this.connectionSubscriptions.entries()) {
      perConnection[connId] = set.size;
    }
    return {
      totalActive: this.tracked.size,
      perConnection,
    };
  }
}
