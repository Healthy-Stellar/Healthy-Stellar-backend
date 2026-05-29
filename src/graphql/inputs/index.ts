import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecordType, GrantStatus } from '../enums';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.js';

/* ─────────────── Pagination ─────────────── */

@InputType()
export class PaginationInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  before?: string;

  @Field(() => Int, { defaultValue: 20 })
  @IsOptional()
  @Min(1)
  first?: number = 20;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Min(1)
  last?: number;
}

/* ─────────────── Record filter ─────────────── */

@InputType()
export class RecordFilterInput {
  @Field(() => RecordType, { nullable: true })
  @IsOptional()
  @IsEnum(RecordType)
  recordType?: RecordType;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fromDate?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  toDate?: Date;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  uploadedBy?: string;
}

/* ─────────────── Upload record ─────────────── */

@InputType()
export class UploadRecordInput {
  @Field(() => GraphQLUpload)
  file: Promise<{ filename: string; mimetype: string; createReadStream: () => NodeJS.ReadableStream }>;

  @Field(() => RecordType)
  @IsEnum(RecordType)
  recordType: RecordType;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  recordDate?: Date;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

/* ─────────────── Grant access ─────────────── */

@InputType()
export class GrantAccessInput {
  @Field(() => ID)
  @IsUUID()
  recordId: string;

  @Field(() => ID)
  @IsUUID()
  providerId: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}

/* ─────────────── Update profile ─────────────── */

@InputType()
export class UpdateProfileInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  specialty?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;

  @Field(() => GraphQLUpload, { nullable: true })
  avatar?: Promise<{ filename: string; mimetype: string; createReadStream: () => NodeJS.ReadableStream }>;
}

/* ─────────────── Register device ─────────────── */

@InputType()
export class RegisterDeviceInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  pushToken: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  platform: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  deviceModel?: string;
}
