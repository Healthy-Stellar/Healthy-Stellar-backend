import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum GqlAccessLevel {
  READ = 'READ',
  READ_WRITE = 'READ_WRITE',
}

export enum GqlGrantStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

registerEnumType(GqlAccessLevel, { name: 'AccessLevel' });
registerEnumType(GqlGrantStatus, { name: 'GrantStatus' });

@ObjectType()
export class AccessGrantType {
  @Field(() => ID)
  id: string;

  @Field()
  patientId: string;

  @Field()
  granteeId: string;

  @Field(() => [String])
  recordIds: string[];

  @Field(() => GqlAccessLevel)
  accessLevel: GqlAccessLevel;

  @Field(() => GqlGrantStatus)
  status: GqlGrantStatus;

  @Field()
  isEmergency: boolean;

  @Field({ nullable: true })
  emergencyReason?: string;

  @Field({ nullable: true })
  expiresAt?: Date;

  @Field({ nullable: true })
  revokedAt?: Date;

  @Field({ nullable: true })
  revocationReason?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
