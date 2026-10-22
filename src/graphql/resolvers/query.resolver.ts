import {
  Args,
  Context,
  ID,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Complexity } from 'graphql-query-complexity';

import { User } from '../types/user.type';
import { MedicalRecord, MedicalRecordConnection } from '../types/medical-record.type';
import { AccessGrant } from '../types/access-grant.type';
import { AuditLog, AuditLogConnection } from '../types/audit-log.type';
import { RecordFilterInput, PaginationInput } from '../inputs';
import { GrantStatus, UserRole } from '../enums';
import { GqlAuthGuard, GqlRolesGuard, CurrentUser, Roles } from '../guards/gql-auth.guard';
import { UserDataLoader } from '../dataloaders/user.dataloader';
import { RecordDataLoader } from '../dataloaders/record.dataloader';
import { buildConnection } from '../utils/pagination.util';

import { MedicalRecordsService } from '../../records/services/medical-records.service';
import { AccessGrantsService } from '../../records/services/access-grants.service';
import { AuditLogService } from '../../records/services/audit-log.service';
import { UsersService } from '../../users/users.service';
import { ForbiddenException } from '@nestjs/common';

interface GqlContext {
  req: { user: { sub: string; role: UserRole } };
}

/* ═══════════════════════════════════════════════════════════ */
/*                     Root Query Resolver                      */
/* ═══════════════════════════════════════════════════════════ */

@Resolver()
@UseGuards(GqlAuthGuard)
export class QueryResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly recordsService: MedicalRecordsService,
    private readonly grantsService: AccessGrantsService,
    private readonly auditService: AuditLogService,
    private readonly userLoader: UserDataLoader,
  ) {}

  /* ────────────── me ────────────── */

  @Query(() => User, { description: "Returns the authenticated user's full profile" })
  async me(@CurrentUser() user: { sub: string }): Promise<User> {
    return this.usersService.findById(user.sub);
  }

  /* ────────────── record(id) ────────────── */

  @Query(() => MedicalRecord, { description: 'Fetch a single record with access verification' })
  @Complexity(10)
  async record(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: { sub: string; role: UserRole },
  ): Promise<MedicalRecord> {
    return this.recordsService.findByIdWithAccessCheck(id, user.sub, user.role);
  }

  /* ────────────── records(filter, pagination) ────────────── */

  @Query(() => MedicalRecordConnection, {
    description: 'Paginated list of records using Relay-style cursor pagination',
  })
  @Complexity(({ args, childComplexity }) => args.pagination?.first * childComplexity || 20 * childComplexity)
  async records(
    @Args('filter', { nullable: true, type: () => RecordFilterInput })
    filter: RecordFilterInput | undefined,
    @Args('pagination', { nullable: true, type: () => PaginationInput })
    pagination: PaginationInput = { first: 20 },
    @CurrentUser() user: { sub: string; role: UserRole },
  ): Promise<MedicalRecordConnection> {
    const { items, total } = await this.recordsService.findPaginated(
      user.sub,
      user.role,
      filter,
      pagination,
    );
    return buildConnection(items, pagination, total) as MedicalRecordConnection;
  }

  /* ────────────── accessGrants ────────────── */

  @Query(() => [AccessGrant], { description: 'List access grants — filtered by patient and/or status' })
  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @UseGuards(GqlRolesGuard)
  async accessGrants(
    @Args('patientId', { type: () => ID, nullable: true }) patientId: string | undefined,
    @Args('status', { type: () => GrantStatus, nullable: true }) status: GrantStatus | undefined,
    @CurrentUser() user: { sub: string; role: UserRole },
  ): Promise<AccessGrant[]> {
    const targetPatientId =
      user.role === UserRole.ADMIN ? patientId ?? user.sub : user.sub;
    return this.grantsService.findByPatient(targetPatientId, status);
  }

  /* ────────────── auditLog ────────────── */

  @Query(() => AuditLogConnection, { description: 'Paginated audit trail for a resource' })
  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @UseGuards(GqlRolesGuard)
  @Complexity(({ args, childComplexity }) => args.pagination?.first * childComplexity || 20 * childComplexity)
  async auditLog(
    @Args('resourceId', { type: () => ID }) resourceId: string,
    @Args('pagination', { nullable: true, type: () => PaginationInput })
    pagination: PaginationInput = { first: 20 },
    @CurrentUser() user: { sub: string; role: UserRole },
  ): Promise<AuditLogConnection> {
    const { items, total } = await this.auditService.findPaginated(
      resourceId,
      user.sub,
      user.role,
      pagination,
    );
    return buildConnection(items, pagination, total) as AuditLogConnection;
  }

  /* ────────────── provider(id) ────────────── */

  @Query(() => User, { description: 'Public provider profile' })
  async provider(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<User> {
    return this.usersService.findProviderById(id);
  }

  /* ────────────── providers(search, specialty) ────────────── */

  @Query(() => [User], { description: 'Provider directory — searchable by name or specialty' })
  async providers(
    @Args('search', { nullable: true }) search: string | undefined,
    @Args('specialty', { nullable: true }) specialty: string | undefined,
  ): Promise<User[]> {
    return this.usersService.findProviders({ search, specialty });
  }
}

/* ═══════════════════════════════════════════════════════════ */
/*               MedicalRecord field resolvers                  */
/* ═══════════════════════════════════════════════════════════ */

@Resolver(() => MedicalRecord)
@UseGuards(GqlAuthGuard)
export class MedicalRecordFieldResolver {
  constructor(
    private readonly userLoader: UserDataLoader,
    private readonly recordLoader: RecordDataLoader,
    private readonly auditService: AuditLogService,
  ) {}

  @ResolveField(() => User)
  async patient(@Parent() record: MedicalRecord): Promise<User> {
    return this.userLoader.load(record.patientId) as unknown as User;
  }

  @ResolveField(() => User, { nullable: true })
  async uploadedBy(@Parent() record: MedicalRecord): Promise<User | null> {
    if (!record.uploadedById) return null;
    return this.userLoader.load(record.uploadedById) as unknown as User;
  }

  @ResolveField(() => [AccessGrant])
  async accessGrants(@Parent() record: MedicalRecord): Promise<AccessGrant[]> {
    return this.recordLoader.loadGrantsForRecord(record.id) as unknown as AccessGrant[];
  }

  /**
   * Field-level auth: only PATIENT (owner) or ADMIN may resolve auditLog.
   * Returns null silently for providers — field is nullable in schema.
   */
  @ResolveField(() => AuditLogConnection, { nullable: true })
  async auditLog(
    @Parent() record: MedicalRecord,
    @Context() ctx: GqlContext,
    @Args('pagination', { nullable: true, type: () => PaginationInput })
    pagination: PaginationInput = { first: 20 },
  ): Promise<AuditLogConnection | null> {
    const { sub, role } = ctx.req.user;
    const isOwner = record.patientId === sub;

    if (!isOwner && role !== UserRole.ADMIN) return null;

    const { items, total } = await this.auditService.findPaginated(
      record.id,
      sub,
      role,
      pagination,
    );
    return buildConnection(items, pagination, total) as AuditLogConnection;
  }
}

/* ═══════════════════════════════════════════════════════════ */
/*               AccessGrant field resolvers (DataLoader)       */
/* ═══════════════════════════════════════════════════════════ */

@Resolver(() => AccessGrant)
export class AccessGrantFieldResolver {
  constructor(private readonly userLoader: UserDataLoader) {}

  @ResolveField(() => User)
  async patient(@Parent() grant: AccessGrant): Promise<User> {
    return this.userLoader.load(grant.patientId) as unknown as User;
  }

  @ResolveField(() => User)
  async provider(@Parent() grant: AccessGrant): Promise<User> {
    return this.userLoader.load(grant.providerId) as unknown as User;
  }
}

/* ═══════════════════════════════════════════════════════════ */
/*               AuditLog field resolver (DataLoader)           */
/* ═══════════════════════════════════════════════════════════ */

@Resolver(() => AuditLog)
export class AuditLogFieldResolver {
  constructor(private readonly userLoader: UserDataLoader) {}

  @ResolveField(() => User, { nullable: true })
  async actor(@Parent() log: AuditLog): Promise<User | null> {
    if (!log.actorId) return null;
    return this.userLoader.load(log.actorId) as unknown as User;
  }
}
