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
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { MedicalRecord } from '../types/medical-record.type';
import { Patient } from '../types/patient.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { DataloaderService } from '../dataloader.service';
import { MedicalRecordsService } from '../../medical-records/services/medical-records.service';
import { AddRecordInput } from '../types/inputs';
import { TenantContext } from '../../tenant/context/tenant.context';
import DataLoader from 'dataloader';

interface RecordService {
  findOne(id: string, requesterId: string): Promise<MedicalRecord | null>;
  findByPatient(patientId: string, requesterId: string): Promise<MedicalRecord[]>;
  add(input: AddRecordInput, requesterId: string): Promise<MedicalRecord>;
}

@Resolver(() => MedicalRecord)
@UseGuards(GqlAuthGuard)
export class MedicalRecordResolver {
  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
    private readonly dataloaderService: DataloaderService,
    @InjectRepository(RecordEntity)
    private readonly recordRepo: Repository<RecordEntity>,
  ) {}

  @Query(() => MedicalRecord, { nullable: true })
  async record(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: { req: { user: { sub: string } } },
  ): Promise<MedicalRecord | null> {
    const organizationId = TenantContext.getTenantId();
    if (!organizationId) {
      throw new ForbiddenException('Tenant context not found');
    }

    try {
      const record = await this.medicalRecordsService.findOne(id, undefined, organizationId);
      return this.mapToGraphQL(record);
    } catch {
      return null;
    }
  }

  @Query(() => [MedicalRecord])
  async records(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Context() ctx: { req: { user: { sub: string } } },
  ): Promise<MedicalRecord[]> {
    const organizationId = TenantContext.getTenantId();
    if (!organizationId) {
      throw new ForbiddenException('Tenant context not found');
    }

    const result = await this.medicalRecordsService.search(
      { patientId, limit: 100, page: 1 },
      organizationId,
    );
    return result.data.map((r) => this.mapToGraphQL(r));
  }

  @Mutation(() => MedicalRecord)
  async addRecord(
    @Args('input') input: AddRecordInput,
    @Context() ctx: { req: { user: { sub: string } } },
  ): Promise<MedicalRecord> {
    const organizationId = TenantContext.getTenantId();
    if (!organizationId) {
      throw new ForbiddenException('Tenant context not found');
    }

    const record = await this.medicalRecordsService.create(
      {
        patientId: input.patientId,
        recordType: input.recordType,
        description: input.description,
      } as any,
      ctx.req.user.sub,
      ctx.req.user.sub,
      organizationId,
    );
    return this.mapToGraphQL(record);
  }

  private mapToGraphQL(record: any): MedicalRecord {
    return {
      id: record.id,
      patientId: record.patientId,
      recordType: record.recordType,
      status: record.status,
      title: record.title,
      description: record.description,
      stellarTxHash: record.stellarTxHash,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      uploadedBy: record.createdBy,
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

  private toGqlType(r: RecordEntity, uploadedBy: string): MedicalRecord {
    return {
      id: r.id,
      patientId: r.patientId,
      cid: r.cid,
      recordType: r.recordType as string,
      stellarTxHash: r.stellarTxHash,
      uploadedBy,
      createdAt: r.createdAt,
      updatedAt: r.createdAt,
    };
  }
}
