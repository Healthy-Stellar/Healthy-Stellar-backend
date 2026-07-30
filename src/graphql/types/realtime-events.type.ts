import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('RecordAccessedEvent')
export class RecordAccessedEventType {
  @Field(() => ID)
  eventId: string;

  @Field(() => ID)
  patientId: string;

  @Field(() => ID)
  actorId: string;

  @Field(() => ID)
  recordId: string;

  @Field()
  timestamp: string;
}

@ObjectType('AccessGrantedEvent')
export class AccessGrantedEventType {
  @Field(() => ID)
  eventId: string;

  @Field(() => ID)
  patientId: string;

  @Field(() => ID)
  actorId: string;

  @Field(() => ID)
  grantId: string;

  @Field(() => ID, { nullable: true })
  granteeId?: string;

  @Field()
  timestamp: string;
}

@ObjectType('AccessRevokedEvent')
export class AccessRevokedEventType {
  @Field(() => ID)
  eventId: string;

  @Field(() => ID)
  patientId: string;

  @Field(() => ID)
  actorId: string;

  @Field(() => ID)
  grantId: string;

  @Field({ nullable: true })
  reason?: string;

  @Field()
  timestamp: string;
}

@ObjectType('RecordUploadedEvent')
export class RecordUploadedEventType {
  @Field(() => ID)
  eventId: string;

  @Field(() => ID)
  patientId: string;

  @Field(() => ID)
  actorId: string;

  @Field(() => ID)
  recordId: string;

  @Field()
  timestamp: string;
}

@ObjectType('JobStatusEvent')
export class JobStatusEventType {
  @Field(() => ID)
  eventId: string;

  @Field(() => ID)
  jobId: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  message?: string;

  @Field()
  updatedAt: string;
}
