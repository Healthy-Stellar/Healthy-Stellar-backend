import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum GqlDataResidencyRegion {
  EU = 'EU',
  US = 'US',
  APAC = 'APAC',
}

registerEnumType(GqlDataResidencyRegion, { name: 'DataResidencyRegion' });

@ObjectType()
export class TenantType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  stellarContractAddress?: string;

  @Field()
  status: string;

  @Field(() => GqlDataResidencyRegion)
  region: GqlDataResidencyRegion;

  @Field()
  strictDataResidency: boolean;

  @Field(() => [String], { nullable: true })
  allowedIpRanges?: string[];
}
