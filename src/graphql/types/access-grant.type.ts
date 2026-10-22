import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GrantStatus } from '../enums';
import { User } from './user.type';

@ObjectType()
export class AccessGrant {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  patientId: string;

  @Field(() => User)
  patient: User;

  @Field(() => String)
  providerId: string;

  @Field(() => User)
  provider: User;

  @Field(() => String)
  recordId: string;

  @Field(() => GrantStatus)
  status: GrantStatus;

  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
