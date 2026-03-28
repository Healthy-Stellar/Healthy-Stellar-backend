import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Context,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InputType, Field } from '@nestjs/graphql';
import { MedicalRecord } from '../types/medical-record.type';
import { Patient } from '../types/patient.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { DataloaderService } from '../dataloader.service';
import DataLoader from 'dataloader';

@InputType()
export class AddRecordInput {
  @Field()
  patientId: string;

  @Field()
  cid: string;

  @Field()
  recordType: string;

  @Field({ nullable: true })
  stellarTxHash?: string;
}

interface RecordService {
  findOne(id: string, requesterId: string): Promise<MedicalRecord | null>;
  findByPatient(patientId: string, requesterId: string): Promise<MedicalRecord[]>;
  add(input: AddRecordInput, requesterId: string): Promise<MedicalRecord>;
}

@Resolver(() => MedicalRecord)
@UseGuards(GqlAuthGuard)
export class MedicalRecordResolver {
  constructor(
    // TODO: inject actual service
    // private readonly recordService: RecordService,
    private readonly dataloaderService: DataloaderService,
  ) {}

  @Query(() => MedicalRecord, { nullable: true })
  async record(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: { req: { user: { sub: string } } },
  ): Promise<MedicalRecord | null> {
    // TODO: return this.recordService.findOne(id, ctx.req.user.sub);
    return {
      id,
      patientId: 'stub-patient-id',
      cid: 'stub-cid',
      recordType: 'lab_result',
      uploadedBy: ctx.req.user.sub,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  @Query(() => [MedicalRecord])
  async records(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: { req: { user: { sub: string } } },
  ): Promise<MedicalRecord[]> {
    // TODO: return this.recordService.findByPatient(patientId, ctx.req.user.sub);
    return [];
  }

  @Mutation(() => MedicalRecord)
  async addRecord(
    @Args('input') input: AddRecordInput,
    @Context() ctx: { req: { user: { sub: string } } },
  ): Promise<MedicalRecord> {
    // TODO: return this.recordService.add(input, ctx.req.user.sub);
    return {
      id: 'stub-id',
      patientId: input.patientId,
      cid: input.cid,
      recordType: input.recordType,
      stellarTxHash: input.stellarTxHash,
      uploadedBy: ctx.req.user.sub,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // DataLoader field resolver — prevents N+1 when querying patient on each record
  @ResolveField(() => Patient, { nullable: true })
  async patient(
    @Parent() record: MedicalRecord,
    @Context() ctx: { patientLoader: DataLoader<string, Patient> },
  ): Promise<Patient | null> {
    return ctx.patientLoader.load(record.patientId);
  }
}
