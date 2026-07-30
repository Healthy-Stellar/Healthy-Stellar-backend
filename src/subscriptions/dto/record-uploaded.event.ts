import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class RecordUploadedEvent {
  @Field(() => ID)
  recordId: string;

  @Field(() => ID)
  patientId: string;

  @Field()
  uploadedBy: string;

  @Field()
  uploadedAt: Date;

  @Field()
  fileName: string;

  @Field({ nullable: true })
  fileSize?: number;
}
