import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TenantType } from '../types/tenant.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlRolesGuard } from '../guards/gql-roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';

@Resolver(() => TenantType)
@UseGuards(GqlAuthGuard, GqlRolesGuard)
export class TenantsResolver {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  @Query(() => [TenantType], { description: 'Admin: list all tenants' })
  @Roles(UserRole.ADMIN)
  async tenants(): Promise<TenantType[]> {
    return this.tenantRepo.find() as any;
  }

  @Query(() => TenantType, { nullable: true, description: 'Admin: get tenant by ID' })
  @Roles(UserRole.ADMIN)
  async tenant(@Args('id', { type: () => ID }) id: string): Promise<TenantType | null> {
    return this.tenantRepo.findOne({ where: { id } }) as any;
  }
}
