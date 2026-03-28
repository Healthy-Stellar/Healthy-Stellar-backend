import { Resolver, Mutation, Args, ID, Context, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InputType, Field } from '@nestjs/graphql';
import { AccessGrant } from '../types/access-grant.type';
import { Patient } from '../types/patient.type';
import { Provider } from '../types/provider.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { DataloaderService } from '../dataloader.service';
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

interface AccessService {
  grant(input: GrantAccessInput, requesterId: string): Promise<AccessGrant>;
  revoke(input: RevokeAccessInput, requesterId: string): Promise<AccessGrant>;
}

@Resolver(() => AccessGrant)
@UseGuards(GqlAuthGuard)
export class AccessGrantResolver {
  constructor(
    // TODO: inject actual service
    // private readonly accessService: AccessService,
    private readonly dataloaderService: DataloaderService,
  ) {}

  @Mutation(() => AccessGrant)
  async grantAccess(
    @Args('input') input: GrantAccessInput,
    @Context() ctx: { req: { user: { sub: string } } },
  ): Promise<AccessGrant> {
    // TODO: return this.accessService.grant(input, ctx.req.user.sub);
    return {
      id: 'stub-grant-id',
      patientId: input.patientId,
      providerId: input.providerId,
      isActive: true,
      expiresAt: input.expiresAt,
      grantedAt: new Date(),
    };
  }

  @Mutation(() => AccessGrant)
  async revokeAccess(
    @Args('input') input: RevokeAccessInput,
    @Context() ctx: { req: { user: { sub: string } } },
  ): Promise<AccessGrant> {
    // TODO: return this.accessService.revoke(input, ctx.req.user.sub);
    return {
      id: 'stub-grant-id',
      patientId: input.patientId,
      providerId: input.providerId,
      isActive: false,
      grantedAt: new Date(),
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
