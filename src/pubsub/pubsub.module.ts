import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphqlPubSubService } from './services/graphql-pubsub.service';
import { PubSubService } from './pubsub.service';
import { RedisStreamService } from './redis-stream.service';

@Module({
  imports: [ConfigModule],
  providers: [GraphqlPubSubService, PubSubService, RedisStreamService],
  exports: [GraphqlPubSubService, PubSubService, RedisStreamService],
})
export class PubSubModule {}
