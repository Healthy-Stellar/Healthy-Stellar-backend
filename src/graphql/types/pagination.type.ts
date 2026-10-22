import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Type } from '@nestjs/common';

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;

  @Field(() => String, { nullable: true })
  startCursor?: string;

  @Field(() => String, { nullable: true })
  endCursor?: string;
}

export function ConnectionType<T>(NodeType: Type<T>): any {
  @ObjectType(`${NodeType.name}Edge`)
  class EdgeType {
    @Field(() => String)
    cursor: string;

    @Field(() => NodeType)
    node: T;
  }

  @ObjectType({ isAbstract: true })
  class Connection {
    @Field(() => [EdgeType])
    edges: EdgeType[];

    @Field(() => PageInfo)
    pageInfo: PageInfo;

    @Field(() => Int)
    totalCount: number;
  }

  return Connection;
}
