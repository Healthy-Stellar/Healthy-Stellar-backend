import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('key_rotation_log')
export class KeyRotationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'old_key_version', type: 'varchar', length: 50 })
  oldKeyVersion: string;

  @Column({ name: 'new_key_version', type: 'varchar', length: 50 })
  newKeyVersion: string;

  @Column({ name: 'reencrypted_count', type: 'int', default: 0 })
  reencryptedCount: number;

  @Column({ name: 'operator_id', type: 'varchar', length: 255 })
  operatorId: string;

  @Column({ name: 'phase', type: 'varchar', length: 20 })
  phase: string; // 'started' | 'completed' | 'failed'

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;
}
