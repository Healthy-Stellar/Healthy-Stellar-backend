import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum GqlRecordType {
  MEDICAL_REPORT = 'MEDICAL_REPORT',
  LAB_RESULT = 'LAB_RESULT',
  PRESCRIPTION = 'PRESCRIPTION',
  IMAGING = 'IMAGING',
  CONSULTATION = 'CONSULTATION',
}

registerEnumType(GqlRecordType, { name: 'RecordType' });

@ObjectType()
export class MedicalRecordType {
  @Field(() => ID)
  id: string;

  @Field()
  patientId: string;

  @Field()
  cid: string;

  @Field({ nullable: true })
  stellarTxHash?: string;

  @Field(() => GqlRecordType)
  recordType: GqlRecordType;

  @Field({ nullable: true })
  description?: string;

  @Field()
  createdAt: Date;
}
