import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('mfa_recovery_codes')
@Index(['userId', 'consumedAt']) // fast lookup of active codes per user
export class MfaRecoveryCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** argon2 hash of the plaintext code — never store plaintext */
  @Column({ type: 'varchar', length: 512 })
  codeHash: string;

  /** Set when the code is used; null = still valid */
  @Column({ type: 'timestamp with time zone', nullable: true, default: null })
  consumedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
