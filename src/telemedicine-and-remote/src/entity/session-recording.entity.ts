import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Encrypted-at-rest telemedicine session recording.
 * The recording payload itself is encrypted with a per-recording DEK
 * (AES-256-GCM); the DEK is envelope-encrypted via the key-management module
 * and stored alongside it so it can only be unwrapped through that module.
 */
@Entity('session_recordings')
@Index(['sessionId'])
export class SessionRecording {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sessionId: string;

  @Column({ type: 'varchar' })
  storageKey: string;

  @Column({ type: 'varchar' })
  originalFilename: string;

  @Column({ type: 'varchar' })
  mimeType: string;

  @Column({ type: 'bigint' })
  fileSize: number;

  /** Envelope-encrypted DEK fields, as returned by KeyManagementService.generateDEK */
  @Column({ type: 'text' })
  dekCiphertext: string;

  @Column({ type: 'text' })
  dekIv: string;

  @Column({ type: 'text' })
  dekAuthTag: string;

  @Column({ type: 'varchar' })
  masterKeyVersion: string;

  /** IV/auth tag used when encrypting the recording payload with the unwrapped DEK */
  @Column({ type: 'text' })
  recordingIv: string;

  @Column({ type: 'text' })
  recordingAuthTag: string;

  @Column({ type: 'varchar', nullable: true })
  uploadedBy: string;

  @Column({ type: 'timestamp' })
  retentionExpiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
