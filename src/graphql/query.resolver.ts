import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/role.enum';
import { RecordsService } from '../medical-records/records.service';
import { Record } from '../medical-records/entities/record.entity';

@Resolver()
export class QueryResolver {
  constructor(private readonly recordsService: RecordsService) {}

  @Query(() => [Record], { name: 'records' })
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DOCTOR, Role.PATIENT)
  async records(): Promise<Record[]> {
    return this.recordsService.findAll();
  }

  @Query(() => Record, { name: 'record', nullable: true })
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DOCTOR, Role.PATIENT)
  async record(@Args('id', { type: () => Int }) id: number): Promise<Record | null> {
    return this.recordsService.findOne(id);
  }
}
