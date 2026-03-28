import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Provider {
  @Field(() => ID)
  id: string;

  @Field()
  address: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  specialty?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
