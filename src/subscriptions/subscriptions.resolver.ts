import { Resolver, Subscription, Args, ID, Context, Query } from '@nestjs/graphql';
import { Gauge } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionContext } from './guards/subscription-auth.guard';
import { RecordAccessedEvent } from './dto/record-accessed.event';
import { AccessGrantedEvent } from './dto/access-granted.event';
import { AccessRevokedEvent } from './dto/access-revoked.event';
import { RecordUploadedEvent } from './dto/record-uploaded.event';
import { JobStatusEvent } from './dto/job-status.event';

/**
 * Wraps a raw PubSub AsyncIterator in an AsyncGenerator that:
 *  1. Increments the subscriptions_active gauge on entry.
 *  2. Registers a one-shot 'close' listener on the WebSocket so that when the
 *     client disconnects the iterator is explicitly terminated via return().
 *  3. Decrements the gauge and removes the listener on any exit path
 *     (normal completion, client disconnect, or thrown error).
 */
async function* withDisconnectCleanup<T>(
  iterator: AsyncIterator<T>,
  ctx: SubscriptionContext,
  gauge: Gauge<string>,
): AsyncGenerator<T> {
  gauge.inc();

  let disconnected = false;
  const disconnectHandler = () => {
    disconnected = true;
    iterator.return?.();
  };

  // ctx.socket is the raw ws.WebSocket set by graphql-ws / subscriptions-transport-ws
  const socket: { once?: Function; removeListener?: Function } = (ctx as any).socket ?? {};
  socket.once?.('close', disconnectHandler);

  try {
    while (true) {
      if (disconnected) return;
      const { value, done } = await iterator.next();
      if (done) return;
      yield value;
    }
  } finally {
    socket.removeListener?.('close', disconnectHandler);
    iterator.return?.();
    gauge.dec();
  }
}

@Resolver()
export class SubscriptionsResolver {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @InjectMetric('subscriptions_active')
    private readonly subscriptionsActiveGauge: Gauge<string>,
  ) {}

  // Health check query required — GraphQL schema must have at least one query
  @Query(() => String)
  subscriptionsHealth(): string {
    return 'ok';
  }

  @Subscription(() => RecordAccessedEvent, {
    filter(payload, variables) {
      return payload.recordAccessed.patientId === variables.patientId;
    },
    resolve: (payload) => payload.recordAccessed,
  })
  recordAccessed(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: SubscriptionContext,
  ): AsyncGenerator<RecordAccessedEvent> {
    this.subscriptionsService.assertPatientAccess(patientId, ctx.user?.patientId);
    return withDisconnectCleanup(
      this.subscriptionsService.getRecordAccessedIterator(patientId),
      ctx,
      this.subscriptionsActiveGauge,
    );
  }

  @Subscription(() => AccessGrantedEvent, {
    filter(payload, variables) {
      return payload.accessGranted.patientId === variables.patientId;
    },
    resolve: (payload) => payload.accessGranted,
  })
  accessGranted(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: SubscriptionContext,
  ): AsyncGenerator<AccessGrantedEvent> {
    this.subscriptionsService.assertPatientAccess(patientId, ctx.user?.patientId);
    return withDisconnectCleanup(
      this.subscriptionsService.getAccessGrantedIterator(patientId),
      ctx,
      this.subscriptionsActiveGauge,
    );
  }

  @Subscription(() => AccessRevokedEvent, {
    filter(payload, variables) {
      return payload.accessRevoked.patientId === variables.patientId;
    },
    resolve: (payload) => payload.accessRevoked,
  })
  accessRevoked(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: SubscriptionContext,
  ): AsyncGenerator<AccessRevokedEvent> {
    this.subscriptionsService.assertPatientAccess(patientId, ctx.user?.patientId);
    return withDisconnectCleanup(
      this.subscriptionsService.getAccessRevokedIterator(patientId),
      ctx,
      this.subscriptionsActiveGauge,
    );
  }

  @Subscription(() => RecordUploadedEvent, {
    filter(payload, variables) {
      return payload.recordUploaded.patientId === variables.patientId;
    },
    resolve: (payload) => payload.recordUploaded,
  })
  recordUploaded(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: SubscriptionContext,
  ): AsyncGenerator<RecordUploadedEvent> {
    this.subscriptionsService.assertPatientAccess(patientId, ctx.user?.patientId);
    return withDisconnectCleanup(
      this.subscriptionsService.getRecordUploadedIterator(patientId),
      ctx,
      this.subscriptionsActiveGauge,
    );
  }

  @Subscription(() => JobStatusEvent, {
    filter(payload, variables) {
      return payload.jobStatusUpdated.jobId === variables.jobId;
    },
    resolve: (payload) => payload.jobStatusUpdated,
  })
  jobStatusUpdated(
    @Args('jobId', { type: () => ID }) jobId: string,
    @Context() ctx: SubscriptionContext,
  ): AsyncGenerator<JobStatusEvent> {
    return withDisconnectCleanup(
      this.subscriptionsService.getJobStatusIterator(jobId),
      ctx,
      this.subscriptionsActiveGauge,
    );
  }
}
