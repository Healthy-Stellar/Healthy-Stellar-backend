import { Args, Resolver, Subscription } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { MedicalRecordType, AccessGrantType } from '../types/schema.types';

export const PUB_SUB = 'GQL_PUB_SUB';
export const NEW_RECORD_EVENT = 'onNewRecord';
export const ACCESS_CHANGED_EVENT = 'onAccessChanged';

@Resolver()
export class SubscriptionsResolver {
  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSub) {}

  @Subscription(() => MedicalRecordType, {
    filter: (payload, variables) =>
      payload.onNewRecord.patientId === variables.patientId,
  })
  onNewRecord(
    @Args('patientId') _patientId: string,
  ): AsyncIterableIterator<MedicalRecordType> {
    return this.pubSub.asyncIterableIterator(NEW_RECORD_EVENT);
  }

  @Subscription(() => AccessGrantType, {
    filter: (payload, variables) =>
      payload.onAccessChanged.patientId === variables.patientId,
  })
  onAccessChanged(
    @Args('patientId') _patientId: string,
  ): AsyncIterableIterator<AccessGrantType> {
    return this.pubSub.asyncIterableIterator(ACCESS_CHANGED_EVENT);
  }
}
