import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum RolloutStrategy {
  ALL = 'ALL',
  PERCENTAGE = 'PERCENTAGE',
  ALLOWLIST = 'ALLOWLIST',
}

@Entity('feature_flags')
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  key: string;

  @Column({ default: false })
  enabled: boolean;

  @Column({ type: 'enum', enum: RolloutStrategy, default: RolloutStrategy.ALL })
  strategy: RolloutStrategy;

  /** 0–100 for PERCENTAGE strategy */
  @Column({ type: 'int', default: 0 })
  rolloutPercentage: number;

  /** User/tenant IDs for ALLOWLIST strategy */
  @Column({ type: 'simple-array', nullable: true })
  allowlist: string[];

  @Column({ type: 'text', nullable: true })
  description: string;

  /** Who last toggled this flag */
  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
