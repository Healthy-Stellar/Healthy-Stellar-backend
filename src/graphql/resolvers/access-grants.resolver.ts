import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AccessGrantType } from '../types/access-grant.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlRolesGuard } from '../guards/gql-roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { AccessControlService } from '../../access-control/services/access-control.service';

@Resolver(() => AccessGrantType)
@UseGuards(GqlAuthGuard, GqlRolesGuard)
export class AccessGrantsResolver {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Query(() => [AccessGrantType], { description: 'List active grants for the authenticated patient' })
  async myGrants(@Context() ctx: any): Promise<AccessGrantType[]> {
    const patientId = ctx.req.user?.userId ?? ctx.req.user?.id;
    return this.accessControlService.getPatientGrants(patientId) as any;
  }

  @Query(() => [AccessGrantType], { description: 'List grants received by the authenticated provider' })
  async receivedGrants(@Context() ctx: any): Promise<AccessGrantType[]> {
    const granteeId = ctx.req.user?.userId ?? ctx.req.user?.id;
    return this.accessControlService.getReceivedGrants(granteeId) as any;
  }

  @Mutation(() => AccessGrantType, { description: 'Grant access to a provider' })
  @Roles(UserRole.PATIENT)
  async grantAccess(
    @Args('granteeId', { type: () => ID }) granteeId: string,
    @Args('recordIds', { type: () => [ID] }) recordIds: string[],
    @Args('accessLevel') accessLevel: string,
    @Args('expiresAt', { nullable: true }) expiresAt: string,
    @Context() ctx: any,
  ): Promise<AccessGrantType> {
    const patientId = ctx.req.user?.userId ?? ctx.req.user?.id;
    return this.accessControlService.grantAccess(patientId, {
      granteeId,
      recordIds,
      accessLevel: accessLevel as any,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    }) as any;
  }

  @Mutation(() => AccessGrantType, { description: 'Revoke an existing access grant' })
  @Roles(UserRole.PATIENT)
  async revokeAccess(
    @Args('grantId', { type: () => ID }) grantId: string,
    @Args('reason', { nullable: true }) reason: string,
    @Context() ctx: any,
  ): Promise<AccessGrantType> {
    const patientId = ctx.req.user?.userId ?? ctx.req.user?.id;
    return this.accessControlService.revokeAccess(grantId, patientId, reason) as any;
  }
}
