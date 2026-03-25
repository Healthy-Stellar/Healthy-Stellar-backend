import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuditLogType } from '../types/audit-log.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlRolesGuard } from '../guards/gql-roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../common/entities/audit-log.entity';

@Resolver(() => AuditLogType)
@UseGuards(GqlAuthGuard, GqlRolesGuard)
export class AuditLogsResolver {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  @Query(() => [AuditLogType], { description: 'Admin: list audit logs' })
  @Roles(UserRole.ADMIN)
  async auditLogs(
    @Args('entityId', { type: () => ID, nullable: true }) entityId?: string,
    @Args('userId', { nullable: true }) userId?: string,
    @Args('limit', { defaultValue: 50 }) limit?: number,
  ): Promise<AuditLogType[]> {
    const where: any = {};
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;
    return this.auditLogRepo.find({ where, take: limit, order: { timestamp: 'DESC' } }) as any;
  }

  @Query(() => [AuditLogType], { description: 'Admin: audit logs for a specific entity' })
  @Roles(UserRole.ADMIN)
  async entityAuditLogs(
    @Args('entityType') entityType: string,
    @Args('entityId', { type: () => ID }) entityId: string,
  ): Promise<AuditLogType[]> {
    return this.auditLogRepo.find({
      where: { entityType, entityId },
      order: { timestamp: 'DESC' },
    }) as any;
  }
}
