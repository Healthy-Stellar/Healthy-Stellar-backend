import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { ProviderType } from '../types/schema.types';
import { GqlAuthGuard } from '../guards/gql-auth.guard';

@Resolver(() => ProviderType)
@UseGuards(GqlAuthGuard)
export class ProvidersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => ProviderType, { nullable: true })
  async provider(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ProviderType> {
    return this.usersService.findOne(id) as any;
  }

  @Query(() => [ProviderType])
  async providers(): Promise<ProviderType[]> {
    return this.usersService.findAll() as any;
  }
}
