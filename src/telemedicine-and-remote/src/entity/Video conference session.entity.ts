import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SessionStatus {
  CREATED = 'created',
  ACTIVE = 'active',
  ENDED = 'ended',
  FAILED = 'failed',
}

@Entity('video_conference_sessions')
export class VideoConferenceSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  virtualVisitId: string;

  @Column({ type: 'varchar', unique: true })
  sessionToken: string;

  @Column({ type: 'varchar', nullable: true })
  roomId: string;

  @Column({ type: 'varchar', nullable: true })
  patientToken: string;

  @Column({ type: 'varchar', nullable: true })
  providerToken: string;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.CREATED,
  })
  status: SessionStatus;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date;

  @Column({ type: 'integer', default: 0 })
  durationSeconds: number;

  @Column({ type: 'boolean', default: true })
  isEncrypted: boolean;

  @Column({ type: 'varchar', default: 'AES-256' })
  encryptionAlgorithm: string;

  @Column({ type: 'jsonb', nullable: true })
  participants: {
    patientJoinedAt?: Date;
    providerJoinedAt?: Date;
    patientLeftAt?: Date;
    providerLeftAt?: Date;
  };

  @Column({ type: 'jsonb', nullable: true })
  qualityMetrics: {
    averageVideoBitrate?: number;
    averageAudioBitrate?: number;
    packetLoss?: number;
    latency?: number;
    jitter?: number;
  };

  @Column({ type: 'boolean', default: false })
  recordingEnabled: boolean;

  @Column({ type: 'varchar', nullable: true })
  recordingUrl: string;

  @Column({ type: 'boolean', default: true })
  patientConsentForRecording: boolean;

  @Column({ type: 'text', nullable: true })
  disconnectionReason: string;

  @Column({ type: 'integer', default: 0 })
  reconnectionAttempts: number;

  @Column({ type: 'jsonb', nullable: true })
  technicalLogs: any[];

  @Column({ type: 'varchar', nullable: true })
  ipAddressPatient: string;

  @Column({ type: 'varchar', nullable: true })
  ipAddressProvider: string;

  @Column({ type: 'boolean', default: true })
  hipaaCompliant: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
