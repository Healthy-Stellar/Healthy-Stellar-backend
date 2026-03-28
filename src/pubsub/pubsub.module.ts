import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphqlPubSubService } from './services/graphql-pubsub.service';

@Module({
  imports: [ConfigModule],
  providers: [GraphqlPubSubService],
  exports: [GraphqlPubSubService],
})
export class PubSubModule {}
