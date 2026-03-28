import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Provider } from '../types/provider.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';

interface ProviderService {
  findOne(id: string): Promise<Provider | null>;
  findAll(args: { limit: number; offset: number }): Promise<Provider[]>;
}

@Resolver(() => Provider)
@UseGuards(GqlAuthGuard)
export class ProviderResolver {
  constructor() // TODO: inject actual service
  // private readonly providerService: ProviderService,
  {}

  @Query(() => Provider, { nullable: true })
  async provider(@Args('id', { type: () => ID }) id: string): Promise<Provider | null> {
    // TODO: return this.providerService.findOne(id);
    return {
      id,
      address: `stub-address-${id}`,
      name: 'Stub Provider',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  @Query(() => [Provider])
  async providers(
    @Args('limit', { defaultValue: 20 }) limit: number,
    @Args('offset', { defaultValue: 0 }) offset: number,
  ): Promise<Provider[]> {
    // TODO: return this.providerService.findAll({ limit, offset });
    return [];
  }
}
