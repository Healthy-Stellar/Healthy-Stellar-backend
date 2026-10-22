import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PolicyEffect {
  ALLOW = 'allow',
  DENY = 'deny',
}

export interface PolicyCondition {
  type: 'role' | 'permission' | 'attribute' | 'custom';
  operator:
    | 'equals'
    | 'in'
    | 'contains'
    | 'matches'
    | 'greaterThan'
    | 'lessThan'
    | 'and'
    | 'or'
    | 'not';
  field?: string;
  value?: any;
  conditions?: PolicyCondition[];
}

export interface PolicySubject {
  type: 'user' | 'role' | 'group' | 'attribute';
  value: string | string[];
}

export interface PolicyResource {
  type: 'resource' | 'pattern' | 'attribute';
  value: string | string[];
}

export interface PolicyAction {
  type: 'action' | 'pattern' | 'attribute';
  value: string | string[];
}

@Entity('policies')
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  @Index()
  name: string;

  @Column({ nullable: true, length: 500 })
  description: string;

  @Column({ type: 'enum', enum: PolicyEffect, default: PolicyEffect.ALLOW })
  effect: PolicyEffect;

  @Column({ type: 'jsonb', nullable: true })
  subjects: PolicySubject[];

  @Column({ type: 'jsonb', nullable: true })
  resources: PolicyResource[];

  @Column({ type: 'jsonb', nullable: true })
  actions: PolicyAction[];

  @Column({ type: 'jsonb', nullable: true })
  conditions: PolicyCondition[];

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, length: 255 })
  @Index()
  category: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
