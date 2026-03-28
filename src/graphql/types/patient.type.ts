import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Patient {
  @Field(() => ID)
  id: string;

  @Field()
  address: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  email?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
