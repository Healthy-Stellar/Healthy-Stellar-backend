import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RecordsService } from '../../records/services/records.service';
import { MedicalRecordType } from '../types/schema.types';
import { AddRecordInput } from '../types/inputs';
import { GqlAuthGuard, CurrentUser } from '../guards/gql-auth.guard';
import { DataLoaderService } from '../dataloaders/dataloader.service';

@Resolver(() => MedicalRecordType)
@UseGuards(GqlAuthGuard)
export class RecordsResolver {
  constructor(private readonly recordsService: RecordsService) {}

  @Query(() => MedicalRecordType, { nullable: true })
  async record(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: any,
  ): Promise<MedicalRecordType> {
    const loader: DataLoaderService = ctx.loaders;
    return loader.records.load(id) as any;
  }

  @Query(() => [MedicalRecordType])
  async records(
    @Args('patientId', { type: () => ID }) patientId: string,
    @CurrentUser() user: any,
  ): Promise<MedicalRecordType[]> {
    const result = await this.recordsService.findAll({ patientId } as any);
    return (result?.data ?? []) as any;
  }

  @Mutation(() => MedicalRecordType)
  async addRecord(
    @Args('input') input: AddRecordInput,
    @CurrentUser() user: any,
  ): Promise<MedicalRecordType> {
    const { recordId } = await this.recordsService.uploadRecord(
      {
        patientId: input.patientId,
        cid: input.cid,
        recordType: input.recordType as any,
        description: input.description,
      } as any,
      Buffer.from(''),
      user?.sub,
    );
    return this.recordsService.findOne(recordId) as any;
  }
}
