import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum GdprRequestType {
  EXPORT = 'EXPORT',
  ERASURE = 'ERASURE',
}

export enum GdprRequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('gdpr_requests')
export class GdprRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: GdprRequestType,
  })
  type: GdprRequestType;

  @Column({
    type: 'enum',
    enum: GdprRequestStatus,
    default: GdprRequestStatus.PENDING,
  })
  status: GdprRequestStatus;

  // For EXPORT requests, this will store the secure download link (or path)
  @Column({ type: 'varchar', nullable: true })
  fileUrl: string;

  // For capturing any failure reasons
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
