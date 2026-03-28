import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Patient } from '../types/patient.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';

// Input types — define inline to keep file count manageable
import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class RegisterPatientInput {
  @Field()
  address: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  email?: string;
}

// Replace with actual injected service
interface PatientService {
  findOne(id: string): Promise<Patient | null>;
  findAll(args: { limit: number; offset: number }): Promise<Patient[]>;
  register(input: RegisterPatientInput, requesterId: string): Promise<Patient>;
}

@Resolver(() => Patient)
@UseGuards(GqlAuthGuard)
export class PatientResolver {
  constructor() // TODO: inject actual service
  // private readonly patientService: PatientService,
  {}

  @Query(() => Patient, { nullable: true })
  async patient(@Args('id', { type: () => ID }) id: string): Promise<Patient | null> {
    // TODO: return this.patientService.findOne(id);
    return {
      id,
      address: `stub-address-${id}`,
      name: 'Stub Patient',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  @Query(() => [Patient])
  async patients(
    @Args('limit', { defaultValue: 20 }) limit: number,
    @Args('offset', { defaultValue: 0 }) offset: number,
  ): Promise<Patient[]> {
    // TODO: return this.patientService.findAll({ limit, offset });
    return [];
  }

  @Mutation(() => Patient)
  async registerPatient(
    @Args('input') input: RegisterPatientInput,
    @Context() ctx: { req: { user: { sub: string } } },
  ): Promise<Patient> {
    // TODO: return this.patientService.register(input, ctx.req.user.sub);
    return {
      id: 'stub-id',
      address: input.address,
      name: input.name,
      email: input.email,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
