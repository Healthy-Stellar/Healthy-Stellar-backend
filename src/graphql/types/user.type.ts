import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum GqlUserRole {
  ADMIN = 'admin',
  PHYSICIAN = 'physician',
  NURSE = 'nurse',
  PATIENT = 'patient',
  BILLING_STAFF = 'billing_staff',
  MEDICAL_RECORDS = 'medical_records',
}

registerEnumType(GqlUserRole, { name: 'UserRole' });

@ObjectType()
export class UserType {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field(() => GqlUserRole)
  role: GqlUserRole;

  @Field()
  isActive: boolean;

  @Field()
  mfaEnabled: boolean;

  @Field({ nullable: true })
  lastLoginAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
