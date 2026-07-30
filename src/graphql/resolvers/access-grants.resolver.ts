import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { AccessGrantType } from '../types/schema.types';
import { GrantAccessInput, RevokeAccessInput } from '../types/inputs';
import { GqlAuthGuard, CurrentUser } from '../guards/gql-auth.guard';

@Resolver(() => AccessGrantType)
@UseGuards(GqlAuthGuard)
export class AccessGrantsResolver {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Query(() => [AccessGrantType])
  async accessGrants(
    @Args('patientId', { type: () => ID }) patientId: string,
  ): Promise<AccessGrantType[]> {
    return this.accessControlService.getPatientGrants(patientId) as any;
  }

  @Mutation(() => AccessGrantType)
  async grantAccess(
    @Args('input') input: GrantAccessInput,
    @CurrentUser() user: any,
  ): Promise<AccessGrantType> {
    return this.accessControlService.grantAccess(input.patientId, {
      granteeId: input.granteeId,
      recordIds: input.recordIds,
      accessLevel: input.accessLevel as any,
      expiresAt: input.expiresAt?.toISOString(),
    }) as any;
  }

  @Mutation(() => Boolean)
  async revokeAccess(
    @Args('input') input: RevokeAccessInput,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    await this.accessControlService.revokeAccess(input.grantId, user?.sub ?? '', input.reason);
    return true;
  }
}
