import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum RolloutStrategy {
  /** Enabled for everyone */
  ALL = 'ALL',
  /** Enabled for a percentage of actors (users), deterministically via hash */
  PERCENTAGE = 'PERCENTAGE',
  /** Enabled only for specific actor (user) IDs */
  ALLOWLIST = 'ALLOWLIST',
  /** Enabled only for specific tenant IDs */
  TENANT_ALLOWLIST = 'TENANT_ALLOWLIST',
  /** Enabled for a percentage of tenants, deterministically via hash */
  TENANT_PERCENTAGE = 'TENANT_PERCENTAGE',
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

  /** 0–100 for PERCENTAGE strategy (user-level) */
  @Column({ type: 'int', default: 0 })
  rolloutPercentage: number;

  /** 0–100 for TENANT_PERCENTAGE strategy */
  @Column({ type: 'int', default: 0 })
  tenantRolloutPercentage: number;

  /** Actor (user) IDs for ALLOWLIST strategy */
  @Column({ type: 'simple-array', nullable: true })
  allowlist: string[];

  /** Tenant IDs for TENANT_ALLOWLIST / TENANT_PERCENTAGE strategies */
  @Column({ type: 'simple-array', nullable: true })
  tenantAllowlist: string[];

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
