import { Resolver, Query, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { MedicalRecordType } from '../types/medical-record.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlRolesGuard } from '../guards/gql-roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { RecordsService } from '../../records/services/records.service';

@Resolver(() => MedicalRecordType)
@UseGuards(GqlAuthGuard, GqlRolesGuard)
export class RecordsResolver {
  constructor(private readonly recordsService: RecordsService) {}

  @Query(() => [MedicalRecordType], { description: 'List records for the authenticated patient' })
  async myRecords(@Context() ctx: any): Promise<MedicalRecordType[]> {
    const patientId = ctx.req.user?.userId ?? ctx.req.user?.id;
    const result = await this.recordsService.findAll({ patientId } as any);
    return result.data as any;
  }

  @Query(() => MedicalRecordType, { nullable: true, description: 'Get a single record by ID' })
  async record(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: any,
  ): Promise<MedicalRecordType | null> {
    const requesterId = ctx.req.user?.userId ?? ctx.req.user?.id;
    return this.recordsService.findOne(id, requesterId) as any;
  }

  @Query(() => [MedicalRecordType], { description: 'Admin/Physician: list records with optional patient filter' })
  @Roles(UserRole.ADMIN, UserRole.PHYSICIAN)
  async records(
    @Args('patientId', { type: () => ID, nullable: true }) patientId?: string,
    @Args('limit', { defaultValue: 20 }) limit?: number,
    @Args('page', { defaultValue: 1 }) page?: number,
  ): Promise<MedicalRecordType[]> {
    const result = await this.recordsService.findAll({ patientId, limit, page } as any);
    return result.data as any;
  }
}
