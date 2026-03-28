import { Resolver, Subscription, Args, ID, Context, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionAuthGuard, SubscriptionContext } from './guards/subscription-auth.guard';
import { RecordAccessedEvent } from './dto/record-accessed.event';
import { AccessGrantedEvent } from './dto/access-granted.event';
import { AccessRevokedEvent } from './dto/access-revoked.event';
import { RecordUploadedEvent } from './dto/record-uploaded.event';
import { JobStatusEvent } from './dto/job-status.event';

@Resolver()
export class SubscriptionsResolver {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // Health check query required — GraphQL schema must have at least one query
  @Query(() => String)
  subscriptionsHealth(): string {
    return 'ok';
  }

  @Subscription(() => RecordAccessedEvent, {
    filter(payload, variables, context: SubscriptionContext) {
      return payload.recordAccessed.patientId === variables.patientId;
    },
    resolve: (payload) => payload.recordAccessed,
  })
  recordAccessed(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: SubscriptionContext,
  ): AsyncIterator<RecordAccessedEvent> {
    this.subscriptionsService.assertPatientAccess(patientId, ctx.user?.patientId);
    return this.subscriptionsService.getRecordAccessedIterator(patientId);
  }

  @Subscription(() => AccessGrantedEvent, {
    filter(payload, variables, context: SubscriptionContext) {
      return payload.accessGranted.patientId === variables.patientId;
    },
    resolve: (payload) => payload.accessGranted,
  })
  accessGranted(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: SubscriptionContext,
  ): AsyncIterator<AccessGrantedEvent> {
    this.subscriptionsService.assertPatientAccess(patientId, ctx.user?.patientId);
    return this.subscriptionsService.getAccessGrantedIterator(patientId);
  }

  @Subscription(() => AccessRevokedEvent, {
    filter(payload, variables, context: SubscriptionContext) {
      return payload.accessRevoked.patientId === variables.patientId;
    },
    resolve: (payload) => payload.accessRevoked,
  })
  accessRevoked(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: SubscriptionContext,
  ): AsyncIterator<AccessRevokedEvent> {
    this.subscriptionsService.assertPatientAccess(patientId, ctx.user?.patientId);
    return this.subscriptionsService.getAccessRevokedIterator(patientId);
  }

  @Subscription(() => RecordUploadedEvent, {
    filter(payload, variables, context: SubscriptionContext) {
      return payload.recordUploaded.patientId === variables.patientId;
    },
    resolve: (payload) => payload.recordUploaded,
  })
  recordUploaded(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: SubscriptionContext,
  ): AsyncIterator<RecordUploadedEvent> {
    this.subscriptionsService.assertPatientAccess(patientId, ctx.user?.patientId);
    return this.subscriptionsService.getRecordUploadedIterator(patientId);
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
  ): AsyncIterator<JobStatusEvent> {
    // Job subscriptions are not patient-scoped; JWT auth on handshake is sufficient
    return this.subscriptionsService.getJobStatusIterator(jobId);
  }
}
