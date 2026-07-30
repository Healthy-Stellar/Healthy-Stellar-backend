import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum GqlUserRole {
  ADMIN = 'admin',
  PHYSICIAN = 'physician',
  NURSE = 'nurse',
  PATIENT = 'patient',
}
registerEnumType(GqlUserRole, { name: 'UserRole' });

@ObjectType()
export class PatientType {
  @Field(() => ID) id: string;
  @Field() mrn: string;
  @Field() firstName: string;
  @Field() lastName: string;
  @Field() dateOfBirth: string;
  @Field({ nullable: true }) email?: string;
  @Field() createdAt: Date;
}

@ObjectType()
export class ProviderType {
  @Field(() => ID) id: string;
  @Field() email: string;
  @Field() firstName: string;
  @Field() lastName: string;
  @Field(() => GqlUserRole) role: GqlUserRole;
  @Field({ nullable: true }) specialization?: string;
  @Field({ nullable: true }) department?: string;
  @Field() createdAt: Date;
}

@ObjectType()
export class MedicalRecordType {
  @Field(() => ID) id: string;
  @Field() patientId: string;
  @Field() cid: string;
  @Field({ nullable: true }) stellarTxHash?: string;
  @Field() recordType: string;
  @Field({ nullable: true }) description?: string;
  @Field() createdAt: Date;
}

@ObjectType()
export class AccessGrantType {
  @Field(() => ID) id: string;
  @Field() patientId: string;
  @Field() granteeId: string;
  @Field(() => [String]) recordIds: string[];
  @Field() accessLevel: string;
  @Field() status: string;
  @Field({ nullable: true }) expiresAt?: Date;
  @Field() createdAt: Date;
}
