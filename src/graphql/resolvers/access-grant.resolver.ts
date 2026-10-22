import { Resolver, Mutation, Args, ID, Context, ResolveField, Parent, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InputType, Field } from '@nestjs/graphql';
import { AccessGrant } from '../types/access-grant.type';
import { Patient } from '../types/patient.type';
import { Provider } from '../types/provider.type';
import { GqlAuthGuard, CurrentUser } from '../guards/gql-auth.guard';
import { DataloaderService } from '../dataloader.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import DataLoader from 'dataloader';

@InputType()
export class GrantAccessInput {
  @Field()
  patientId: string;

  @Field()
  providerId: string;

  @Field({ nullable: true })
  expiresAt?: Date;
}

@InputType()
export class RevokeAccessInput {
  @Field()
  patientId: string;

  @Field()
  providerId: string;
}

@Resolver(() => AccessGrant)
@UseGuards(GqlAuthGuard)
export class AccessGrantResolver {
  constructor(
    private readonly accessControlService: AccessControlService,
    private readonly dataloaderService: DataloaderService,
  ) {}

  @Mutation(() => AccessGrant)
  async grantAccess(
    @Args('input') input: GrantAccessInput,
    @CurrentUser() user: { sub: string },
  ): Promise<AccessGrant> {
    const grant = await this.accessControlService.grantAccess(input.patientId, {
      granteeId: input.providerId,
      recordIds: [],
      accessLevel: 'READ' as any,
      expiresAt: input.expiresAt?.toISOString(),
    });
    return {
      id: grant.id,
      patientId: grant.patientId,
      providerId: grant.granteeId,
      isActive: grant.status === 'ACTIVE',
      expiresAt: grant.expiresAt,
      grantedAt: grant.createdAt,
    };
  }

  @Mutation(() => AccessGrant)
  async revokeAccess(
    @Args('input') input: RevokeAccessInput,
    @CurrentUser() user: { sub: string },
  ): Promise<AccessGrant> {
    const grant = await this.accessControlService.revokeAccess(
      input.providerId,
      input.patientId,
    );
    return {
      id: grant.id,
      patientId: grant.patientId,
      providerId: grant.granteeId,
      isActive: false,
      grantedAt: grant.createdAt,
    };
  }

  @ResolveField(() => Patient, { nullable: true })
  async patient(
    @Parent() grant: AccessGrant,
    @Context() ctx: { patientLoader: DataLoader<string, Patient> },
  ): Promise<Patient | null> {
    return ctx.patientLoader.load(grant.patientId);
  }

  @ResolveField(() => Provider, { nullable: true })
  async provider(
    @Parent() grant: AccessGrant,
    @Context() ctx: { providerLoader: DataLoader<string, Provider> },
  ): Promise<Provider | null> {
    return ctx.providerLoader.load(grant.providerId);
  }
}
