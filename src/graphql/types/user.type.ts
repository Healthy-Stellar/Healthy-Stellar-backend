import { Field, ID, ObjectType } from '@nestjs/graphql';
import { UserRole } from '../enums';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field(() => String, { nullable: true })
  displayName?: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field(() => String, { nullable: true })
  specialty?: string;

  @Field(() => String, { nullable: true })
  licenseNumber?: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string;

  @Field(() => String, { nullable: true })
  phoneNumber?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
