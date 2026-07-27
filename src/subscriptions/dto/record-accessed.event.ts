import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class RecordAccessedEvent {
  @Field(() => ID)
  recordId: string;

  @Field(() => ID)
  patientId: string;

  @Field()
  accessedBy: string;

  @Field()
  accessedAt: Date;

  @Field({ nullable: true })
  purpose?: string;
}
