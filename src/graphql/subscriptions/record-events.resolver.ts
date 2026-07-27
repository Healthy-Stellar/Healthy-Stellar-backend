import { Args, Context, Resolver, Subscription } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { MedicalRecord } from '../types/medical-record.type';
import { AccessGrant } from '../types/access-grant.type';
import { GraphqlPubSubService } from '../../pubsub/services/graphql-pubsub.service';

@Resolver()
export class RecordEventsResolver {
  constructor(private readonly pubSub: GraphqlPubSubService) {}

  @Subscription(() => MedicalRecord, {
    filter(payload, variables) {
      return payload.onNewRecord.patientAddress === variables.patientAddress;
    },
    resolve: (payload) => payload.onNewRecord,
  })
  async onNewRecord(
    @Args('patientAddress') patientAddress: string,
    @Context() ctx: any,
  ): Promise<AsyncIterator<MedicalRecord>> {
    const { sessionId, userId } = this.getSessionContext(ctx);
    this.assertAuthenticated(userId);
    return this.pubSub.recordUploadedIterator(patientAddress, undefined, sessionId, userId);
  }

  @Subscription(() => AccessGrant, {
    filter(payload, variables) {
      return payload.onAccessChanged.patientAddress === variables.patientAddress;
    },
    resolve: (payload) => payload.onAccessChanged,
  })
  async onAccessChanged(
    @Args('patientAddress') patientAddress: string,
    @Context() ctx: any,
  ): Promise<AsyncIterator<AccessGrant>> {
    const { sessionId, userId } = this.getSessionContext(ctx);
    this.assertAuthenticated(userId);
    return this.pubSub.accessGrantedIterator(patientAddress, undefined, sessionId, userId);
  }

  private assertAuthenticated(userId: string | undefined): void {
    if (!userId) {
      throw new GraphQLError('Subscription authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
  }

  private getSessionContext(ctx: any): { sessionId: string | undefined; userId: string | undefined } {
    const user = ctx?.user ?? ctx?.req?.user ?? ctx?.extra?.user;
    return {
      sessionId: user?.sessionId,
      userId: user?.userId ?? user?.id,
    };
  }
}
