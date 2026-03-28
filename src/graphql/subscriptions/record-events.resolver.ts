import { Resolver, Subscription, Args } from '@nestjs/graphql';
import { MedicalRecord } from '../types/medical-record.type';
import { AccessGrant } from '../types/access-grant.type';

// Re-use PubSubService from the subscriptions module built in the previous issue
// import { PubSubService } from '../../pubsub/pubsub.service';

const RECORD_EVENTS = {
  NEW_RECORD: 'NEW_RECORD',
  ACCESS_CHANGED: 'ACCESS_CHANGED',
} as const;

@Resolver()
export class RecordEventsResolver {
  constructor() // TODO: inject PubSubService
  // private readonly pubSub: PubSubService,
  {}

  @Subscription(() => MedicalRecord, {
    filter(payload, variables) {
      return payload.onNewRecord.patientAddress === variables.patientAddress;
    },
    resolve: (payload) => payload.onNewRecord,
  })
  onNewRecord(@Args('patientAddress') patientAddress: string): AsyncIterator<MedicalRecord> {
    // TODO: return this.pubSub.asyncIterator(`${RECORD_EVENTS.NEW_RECORD}:${patientAddress}`);
    // Stub iterator — replace when PubSubService is wired
    return (async function* () {})();
  }

  @Subscription(() => AccessGrant, {
    filter(payload, variables) {
      return payload.onAccessChanged.patientAddress === variables.patientAddress;
    },
    resolve: (payload) => payload.onAccessChanged,
  })
  onAccessChanged(@Args('patientAddress') patientAddress: string): AsyncIterator<AccessGrant> {
    // TODO: return this.pubSub.asyncIterator(`${RECORD_EVENTS.ACCESS_CHANGED}:${patientAddress}`);
    return (async function* () {})();
  }
}
