import { Column, Entity, PrimaryColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm';

/**
 * Stores the encrypted DEK for each patient.
 * The plaintext DEK is NEVER persisted — only the master-key-encrypted form.
 */
@Entity('patient_deks')
export class PatientDekEntity {
  @PrimaryColumn({ name: 'patient_address', type: 'varchar', length: 255 })
  patientAddress: string;

  /** AES-256-GCM ciphertext of the DEK (hex-encoded) */
  @Column({ type: 'text' })
  ciphertext: string;

  /** 12-byte IV (hex-encoded) */
  @Column({ type: 'varchar', length: 24 })
  iv: string;

  /** 16-byte GCM auth tag (hex-encoded) */
  @Column({ name: 'auth_tag', type: 'varchar', length: 32 })
  authTag: string;

  /** Master key version that encrypted this DEK */
  @Column({ name: 'master_key_version', type: 'varchar', length: 50 })
  masterKeyVersion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
