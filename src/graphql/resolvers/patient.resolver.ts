import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Patient } from '../types/patient.type';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { PatientsService } from '../../patients/patients.service';

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

@Resolver(() => Patient)
@UseGuards(GqlAuthGuard)
export class PatientResolver {
  constructor(private readonly patientsService: PatientsService) {}

  @Query(() => Patient, { nullable: true })
  async patient(@Args('id', { type: () => ID }) id: string): Promise<Patient | null> {
    const p = await this.patientsService.findById(id);
    if (!p) return null;
    return {
      id: p.id,
      address: (p as any).address ?? '',
      name: `${p.firstName} ${p.lastName}`,
      email: (p as any).email,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  @Query(() => [Patient])
  async patients(
    @Args('limit', { defaultValue: 20 }) limit: number,
    @Args('offset', { defaultValue: 0 }) offset: number,
  ): Promise<Patient[]> {
    const result = await this.patientsService.findAll({ page: 1, limit } as any);
    const items: any[] = Array.isArray(result) ? result : (result as any)?.data ?? [];
    return items.map((p: any) => ({
      id: p.id,
      address: p.address ?? '',
      name: `${p.firstName} ${p.lastName}`,
      email: p.email,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  @Mutation(() => Patient)
  async registerPatient(
    @Args('input') input: RegisterPatientInput,
    @Context() ctx: { req: { user: { sub: string } } },
  ): Promise<Patient> {
    const [firstName, ...rest] = input.name.split(' ');
    const lastName = rest.join(' ') || firstName;
    const p = await this.patientsService.create({
      firstName,
      lastName,
      email: input.email,
    } as any);
    return {
      id: p.id,
      address: (p as any).address ?? input.address,
      name: `${p.firstName} ${p.lastName}`,
      email: (p as any).email,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
