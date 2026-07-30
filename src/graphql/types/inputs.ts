import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsUUID, IsDateString } from 'class-validator';

@InputType()
export class RegisterPatientInput {
  @Field() @IsNotEmpty() firstName: string;
  @Field() @IsNotEmpty() lastName: string;
  @Field() @IsEmail() email: string;
  @Field() @IsNotEmpty() password: string;
  @Field() @IsDateString() dateOfBirth: string;
  @Field({ nullable: true }) @IsOptional() phoneNumber?: string;
}

@InputType()
export class AddRecordInput {
  @Field() @IsUUID() patientId: string;
  @Field() @IsNotEmpty() cid: string;
  @Field() @IsNotEmpty() recordType: string;
  @Field({ nullable: true }) @IsOptional() description?: string;
}

@InputType()
export class GrantAccessInput {
  @Field() @IsUUID() patientId: string;
  @Field() @IsUUID() granteeId: string;
  @Field(() => [String]) recordIds: string[];
  @Field({ defaultValue: 'READ' }) accessLevel: string;
  @Field({ nullable: true }) @IsOptional() expiresAt?: Date;
}

@InputType()
export class RevokeAccessInput {
  @Field() @IsUUID() grantId: string;
  @Field({ nullable: true }) @IsOptional() reason?: string;
}
