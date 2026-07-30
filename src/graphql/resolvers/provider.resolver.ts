import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Provider } from '../types/provider.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { UsersService } from '../../users/users.service';

@Resolver(() => Provider)
@UseGuards(GqlAuthGuard)
export class ProviderResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => Provider, { nullable: true })
  async provider(@Args('id', { type: () => ID }) id: string): Promise<Provider | null> {
    const user = await this.usersService.findOne(id);
    if (!user) return null;
    return {
      id: user.id,
      address: (user as any).address ?? '',
      name: `${user.firstName} ${user.lastName}`,
      specialty: (user as any).specialization,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Query(() => [Provider])
  async providers(
    @Args('limit', { defaultValue: 20 }) limit: number,
    @Args('offset', { defaultValue: 0 }) offset: number,
  ): Promise<Provider[]> {
    const users = await this.usersService.findAll();
    return users.slice(offset, offset + limit).map((user) => ({
      id: user.id,
      address: (user as any).address ?? '',
      name: `${user.firstName} ${user.lastName}`,
      specialty: (user as any).specialization,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }
}
