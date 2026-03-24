import { Resolver, Query, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserType } from '../types/user.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlRolesGuard } from '../guards/gql-roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Resolver(() => UserType)
@UseGuards(GqlAuthGuard, GqlRolesGuard)
export class UsersResolver {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Query(() => UserType, { description: 'Get the currently authenticated user' })
  async me(@Context() ctx: any): Promise<UserType> {
    const userId = ctx.req.user?.userId ?? ctx.req.user?.id;
    return this.userRepo.findOneOrFail({ where: { id: userId } }) as any;
  }

  @Query(() => UserType, { nullable: true, description: 'Admin: get user by ID' })
  @Roles(UserRole.ADMIN)
  async user(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: any,
  ): Promise<UserType | null> {
    const { userLoader } = ctx.loaders;
    return userLoader.load(id) as any;
  }

  @Query(() => [UserType], { description: 'Admin: list all users' })
  @Roles(UserRole.ADMIN)
  async users(): Promise<UserType[]> {
    return this.userRepo.find() as any;
  }
}
