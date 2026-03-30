import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CriticalSeverity {
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('critical_value_definitions')
@Index(['testCode'], { unique: true })
export class CriticalValueDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  testCode: string;

  @Column({ type: 'varchar', length: 100 })
  testName: string;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  criticalLow: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  criticalHigh: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string;

  @Column({ type: 'enum', enum: CriticalSeverity, default: CriticalSeverity.CRITICAL })
  severity: CriticalSeverity;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
