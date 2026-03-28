import { Args, Context, ID, Resolver, Subscription } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { GraphqlPubSubService } from '../../pubsub/services/graphql-pubsub.service';
import {
  AccessGrantedEventType,
  AccessRevokedEventType,
  JobStatusEventType,
  RecordAccessedEventType,
  RecordUploadedEventType,
} from '../types/realtime-events.type';

@Resolver()
export class RealtimeEventsResolver {
  constructor(private readonly graphqlPubSubService: GraphqlPubSubService) {}

  @Subscription(() => RecordAccessedEventType, {
    resolve: (payload: any) => payload.recordAccessed,
  })
  async recordAccessed(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: any,
  ) {
    this.assertPatientScope(ctx, patientId);
    const replayCursor = this.readReplayCursor(ctx, `recordAccessed:${patientId}`);
    return this.graphqlPubSubService.recordAccessedIterator(patientId, replayCursor);
  }

  @Subscription(() => AccessGrantedEventType, {
    resolve: (payload: any) => payload.accessGranted,
  })
  async accessGranted(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: any,
  ) {
    this.assertPatientScope(ctx, patientId);
    const replayCursor = this.readReplayCursor(ctx, `accessGranted:${patientId}`);
    return this.graphqlPubSubService.accessGrantedIterator(patientId, replayCursor);
  }

  @Subscription(() => AccessRevokedEventType, {
    resolve: (payload: any) => payload.accessRevoked,
  })
  async accessRevoked(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: any,
  ) {
    this.assertPatientScope(ctx, patientId);
    const replayCursor = this.readReplayCursor(ctx, `accessRevoked:${patientId}`);
    return this.graphqlPubSubService.accessRevokedIterator(patientId, replayCursor);
  }

  @Subscription(() => RecordUploadedEventType, {
    resolve: (payload: any) => payload.recordUploaded,
  })
  async recordUploaded(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: any,
  ) {
    this.assertPatientScope(ctx, patientId);
    const replayCursor = this.readReplayCursor(ctx, `recordUploaded:${patientId}`);
    return this.graphqlPubSubService.recordUploadedIterator(patientId, replayCursor);
  }

  @Subscription(() => JobStatusEventType, {
    resolve: (payload: any) => payload.jobStatusUpdated,
  })
  async jobStatusUpdated(@Args('jobId', { type: () => ID }) jobId: string, @Context() ctx: any) {
    this.assertAuthenticated(ctx);
    const replayCursor = this.readReplayCursor(ctx, `jobStatusUpdated:${jobId}`);
    return this.graphqlPubSubService.jobStatusUpdatedIterator(jobId, replayCursor);
  }

  private assertAuthenticated(ctx: any): void {
    const userId = this.getUserId(ctx);
    if (!userId) {
      throw new GraphQLError('Subscription authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
  }

  private assertPatientScope(ctx: any, patientId: string): void {
    const userId = this.getUserId(ctx);
    if (!userId) {
      throw new GraphQLError('Subscription authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (userId !== patientId) {
      throw new GraphQLError('Forbidden subscription scope', {
        extensions: { code: 'FORBIDDEN' },
      });
    }
  }

  private getUserId(ctx: any): string | undefined {
    return (
      ctx?.user?.userId ??
      ctx?.req?.user?.userId ??
      ctx?.req?.user?.id ??
      ctx?.extra?.user?.userId ??
      ctx?.extra?.user?.id
    );
  }

  private readReplayCursor(ctx: any, cursorKey: string): string | undefined {
    const cursorMap =
      ctx?.connectionParams?.lastEventIds ?? ctx?.extra?.connectionParams?.lastEventIds;

    if (!cursorMap || typeof cursorMap !== 'object') {
      return undefined;
    }

    const cursor = cursorMap[cursorKey];
    return typeof cursor === 'string' && cursor.length > 0 ? cursor : undefined;
  }
}
