import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('sessions')
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ name: 'refreshTokenHash', unique: true, length: 64 })
  refreshTokenHash: string;

  @Column({ name: 'accessTokenHash', unique: true, length: 64 })
  accessTokenHash: string;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  refreshTokenExpiresAt: Date;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  deviceId: string;

  @Column({ default: false })
  isActive: boolean;

  /**
   * True only once this session has passed a TOTP / backup-code challenge.
   * Access tokens minted for the session (including on refresh) copy this
   * value into their `mfaVerified` claim. It is never derived from the
   * account-level `User.mfaEnabled` flag.
   */
  @Column({ default: false })
  mfaVerified: boolean;

  @Column({ nullable: true })
  revokedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
