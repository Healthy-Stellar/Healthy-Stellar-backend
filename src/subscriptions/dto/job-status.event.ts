import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

registerEnumType(JobStatus, { name: 'JobStatus' });

@ObjectType()
export class JobStatusEvent {
  @Field(() => ID)
  jobId: string;

  @Field(() => JobStatus)
  status: JobStatus;

  @Field()
  updatedAt: Date;

  @Field({ nullable: true })
  progress?: number;

  @Field({ nullable: true })
  message?: string;
}
