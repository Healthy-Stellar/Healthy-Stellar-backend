import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { RecordType } from '../enums';
import { User } from './user.type';
import { AccessGrant } from './access-grant.type';
import { AuditLogConnection } from './audit-log.type';
import { ConnectionType } from './pagination.type';

@ObjectType()
export class MedicalRecord {
  @Field(() => ID)
  id: string;

  @Field(() => RecordType)
  recordType: RecordType;

  @Field()
  title: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field()
  fileUrl: string;

  @Field(() => String, { nullable: true })
  mimeType?: string;

  @Field(() => Int, { nullable: true })
  fileSizeBytes?: number;

  @Field(() => String, { nullable: true })
  stellarTxHash?: string;

  @Field(() => String, { nullable: true })
  ipfsHash?: string;

  @Field(() => String, { nullable: true })
  checksum?: string;

  @Field(() => User)
  patient: User;

  @Field(() => String)
  patientId: string;

  @Field(() => User, { nullable: true })
  uploadedBy?: User;

  @Field(() => String, { nullable: true })
  uploadedById?: string;

  @Field(() => [AccessGrant], { nullable: true })
  accessGrants?: AccessGrant[];

  /** Resolved only for PATIENT or ADMIN — enforced at field-resolver level */
  @Field(() => AuditLogConnection, { nullable: true })
  auditLog?: AuditLogConnection;

  @Field(() => Date, { nullable: true })
  recordDate?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class MedicalRecordConnection extends ConnectionType(MedicalRecord) {}
