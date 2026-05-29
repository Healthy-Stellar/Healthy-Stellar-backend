import { Field, ID, ObjectType } from '@nestjs/graphql';
import { AuditAction } from '../enums';
import { User } from './user.type';
import { ConnectionType } from './pagination.type';

@ObjectType()
export class AuditLog {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  resourceId: string;

  @Field(() => AuditAction)
  action: AuditAction;

  @Field(() => User, { nullable: true })
  actor?: User;

  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String, { nullable: true })
  ipAddress?: string;

  @Field(() => String, { nullable: true })
  userAgent?: string;

  @Field(() => String, { nullable: true })
  metadata?: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class AuditLogConnection extends ConnectionType(AuditLog) {}
