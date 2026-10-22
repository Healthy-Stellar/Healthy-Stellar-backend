import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum RecordingStatus {
  UPLOADING = 'uploading',
  STORED = 'stored',
  PURGED = 'purged',
}

@Entity('session_recordings')
export class SessionRecording {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  sessionId: string;

  @Column({ type: 'varchar' })
  storageKey: string;  // object storage key (e.g., S3 key)

  @Column({ type: 'varchar' })
  encryptedDekId: string;  // reference to encrypted DEK

  @Column({ type: 'bigint', default: 0 })
  fileSizeBytes: number;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'varchar', enum: RecordingStatus, default: RecordingStatus.UPLOADING })
  status: RecordingStatus;

  @Column({ type: 'timestamp', nullable: true })
  retentionExpiresAt: Date | null;

  @Column({ type: 'uuid' })
  uploadedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
