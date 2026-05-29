import { createUnionType, Field, ID, ObjectType } from '@nestjs/graphql';
import { JobStatus } from '../enums';
import { MedicalRecord } from './medical-record.type';
import { AccessGrant } from './access-grant.type';
import { User } from './user.type';

/* ─────────────────────────── Error types ─────────────────────────── */

@ObjectType()
export class ValidationError {
  @Field()
  message: string;

  @Field(() => [FieldError], { nullable: true })
  fieldErrors?: FieldError[];
}

@ObjectType()
export class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
export class UnauthorizedError {
  @Field()
  message: string;
}

@ObjectType()
export class StellarTransactionError {
  @Field()
  message: string;

  @Field(() => String, { nullable: true })
  txHash?: string;

  @Field(() => String, { nullable: true })
  errorCode?: string;
}

@ObjectType()
export class NotFoundError {
  @Field()
  message: string;
}

/* ──────────────────── uploadRecord payload ──────────────────── */

@ObjectType()
export class UploadRecordSuccess {
  @Field(() => MedicalRecord)
  record: MedicalRecord;

  @Field(() => ID, { nullable: true })
  jobId?: string;

  @Field(() => JobStatus, { nullable: true })
  status?: JobStatus;

  @Field(() => Date, { nullable: true })
  estimatedCompletionTime?: Date;

  @Field({ nullable: true })
  idempotent?: boolean;
}

export const UploadRecordPayload = createUnionType({
  name: 'UploadRecordPayload',
  types: () => [
    UploadRecordSuccess,
    ValidationError,
    UnauthorizedError,
    StellarTransactionError,
  ],
  resolveType(value) {
    if ('record' in value) return UploadRecordSuccess;
    if ('fieldErrors' in value || ('message' in value && 'fieldErrors' in value))
      return ValidationError;
    if ('txHash' in value) return StellarTransactionError;
    return UnauthorizedError;
  },
});

/* ──────────────────── grantAccess payload ──────────────────── */

@ObjectType()
export class AccessGrantSuccess {
  @Field(() => AccessGrant)
  grant: AccessGrant;
}

export const AccessGrantPayload = createUnionType({
  name: 'AccessGrantPayload',
  types: () => [AccessGrantSuccess, ValidationError, UnauthorizedError, NotFoundError],
  resolveType(value) {
    if ('grant' in value) return AccessGrantSuccess;
    if ('fieldErrors' in value) return ValidationError;
    if ('message' in value && !('grant' in value)) return UnauthorizedError;
    return NotFoundError;
  },
});

/* ──────────────────── revokeAccess payload ──────────────────── */

@ObjectType()
export class RevokeAccessSuccess {
  @Field(() => ID)
  grantId: string;

  @Field()
  revoked: boolean;
}

export const RevokeAccessPayload = createUnionType({
  name: 'RevokeAccessPayload',
  types: () => [RevokeAccessSuccess, UnauthorizedError, NotFoundError],
  resolveType(value) {
    if ('revoked' in value) return RevokeAccessSuccess;
    if ('message' in value) return UnauthorizedError;
    return NotFoundError;
  },
});

/* ──────────────────── updateProfile payload ──────────────────── */

@ObjectType()
export class UpdateProfileSuccess {
  @Field(() => User)
  user: User;
}

export const UpdateProfilePayload = createUnionType({
  name: 'UpdateProfilePayload',
  types: () => [UpdateProfileSuccess, ValidationError, UnauthorizedError],
  resolveType(value) {
    if ('user' in value) return UpdateProfileSuccess;
    if ('fieldErrors' in value) return ValidationError;
    return UnauthorizedError;
  },
});

/* ──────────────────── registerDevice payload ──────────────────── */

@ObjectType()
export class RegisterDeviceSuccess {
  @Field(() => ID)
  deviceId: string;

  @Field()
  registered: boolean;
}

export const RegisterDevicePayload = createUnionType({
  name: 'RegisterDevicePayload',
  types: () => [RegisterDeviceSuccess, ValidationError, UnauthorizedError],
  resolveType(value) {
    if ('deviceId' in value) return RegisterDeviceSuccess;
    if ('fieldErrors' in value) return ValidationError;
    return UnauthorizedError;
  },
});

/* ──────────────────── GDPR request payload ──────────────────── */

@ObjectType()
export class GdprRequestSuccess {
  @Field(() => ID)
  jobId: string;

  @Field(() => JobStatus)
  status: JobStatus;

  @Field(() => Date, { nullable: true })
  estimatedCompletionTime?: Date;
}

export const GdprRequestPayload = createUnionType({
  name: 'GdprRequestPayload',
  types: () => [GdprRequestSuccess, ValidationError, UnauthorizedError],
  resolveType(value) {
    if ('jobId' in value) return GdprRequestSuccess;
    if ('fieldErrors' in value) return ValidationError;
    return UnauthorizedError;
  },
});
