import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class AuditLogType {
  @Field(() => ID)
  id: string;

  @Field(() => GraphQLISODateTime)
  timestamp: Date;

  @Field()
  operation: string;

  @Field()
  entityType: string;

  @Field({ nullable: true })
  entityId?: string;

  @Field()
  userId: string;

  @Field({ nullable: true })
  ipAddress?: string;

  @Field({ nullable: true })
  userAgent?: string;

  @Field({ nullable: true })
  status?: string;
}
