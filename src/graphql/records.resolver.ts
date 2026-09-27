import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { RecordsService } from './records.service';
import { Record } from '../medical-records/entities/record.entity';
import { CreateRecordInput } from './dto/create-record.input';

@Resolver(() => Record)
@Resolver(() => Record)
export class RecordsResolver {
  constructor(private readonly recordsService: RecordsService) {}

  @Query(() => [Record], { name: 'records' })
  async records(): Promise<Record[]> {
    return this.recordsService.findAll();
  }

  @Query(() => Record, { name: 'record' })
  async record(@Args('id') id: string): Promise<Record> {
    return this.recordsService.findOne(id);
  }

  @Mutation(() => Record, { name: 'addRecord' })
  async addRecord(@Args('input') input: CreateRecordInput): Promise<Record> {
    return this.recordsService.create(input);
  }
}
