import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class AccessRevokedEvent {
  @Field(() => ID)
  patientId: string;

  @Field()
  revokedFrom: string;

  @Field()
  revokedBy: string;

  @Field()
  revokedAt: Date;
}
