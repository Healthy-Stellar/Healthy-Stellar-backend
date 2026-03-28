import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class AccessGrantedEvent {
  @Field(() => ID)
  patientId: string;

  @Field()
  grantedTo: string;

  @Field()
  grantedBy: string;

  @Field()
  grantedAt: Date;

  @Field({ nullable: true })
  expiresAt?: Date;
}
