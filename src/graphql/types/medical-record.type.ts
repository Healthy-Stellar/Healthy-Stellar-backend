import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum GqlMedicalRecordStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

export enum GqlRecordType {
  CONSULTATION = 'consultation',
  DIAGNOSIS = 'diagnosis',
  TREATMENT = 'treatment',
  LAB_RESULT = 'lab_result',
  IMAGING = 'imaging',
  PRESCRIPTION = 'prescription',
  SURGERY = 'surgery',
  EMERGENCY = 'emergency',
  OTHER = 'other',
}

registerEnumType(GqlMedicalRecordStatus, { name: 'MedicalRecordStatus' });
registerEnumType(GqlRecordType, { name: 'RecordType' });

@ObjectType()
export class MedicalRecord {
  @Field(() => ID)
  id: string;

  @Field()
  patientId: string;

  @Field(() => GqlRecordType)
  recordType: GqlRecordType;

  @Field(() => GqlMedicalRecordStatus)
  status: GqlMedicalRecordStatus;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  stellarTxHash?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field({ nullable: true })
  uploadedBy?: string;
}
