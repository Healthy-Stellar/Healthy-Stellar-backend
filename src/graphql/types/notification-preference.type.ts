import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum GqlNotificationEventType {
  RECORD_ACCESSED = 'record.accessed',
  ACCESS_GRANTED = 'access.granted',
  ACCESS_REVOKED = 'access.revoked',
  RECORD_UPLOADED = 'record.uploaded',
  EMERGENCY_ACCESS = 'emergency-access',
}

registerEnumType(GqlNotificationEventType, { name: 'NotificationEventType' });

@ObjectType()
export class NotificationPreferenceType {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field(() => GqlNotificationEventType)
  eventType: GqlNotificationEventType;

  @Field()
  enabled: boolean;

  @Field({ nullable: true })
  email?: boolean;

  @Field({ nullable: true })
  inApp?: boolean;
}
