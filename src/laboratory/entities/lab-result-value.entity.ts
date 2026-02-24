import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { LabResult } from './lab-result.entity';
import { LabTestParameter } from './lab-test-parameter.entity';
import { CriticalValueAlert } from './critical-value-alert.entity';

export enum AbnormalFlag {
  NORMAL = 'normal',
  LOW = 'low',
  HIGH = 'high',
  CRITICAL_LOW = 'critical_low',
  CRITICAL_HIGH = 'critical_high',
  ABNORMAL = 'abnormal',
}

@Entity('lab_result_values')
@Index(['labResultId'])
@Index(['parameterId'])
export class LabResultValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  labResultId: string;

  @Column({ type: 'uuid' })
  parameterId: string;

  @Column({ type: 'varchar', length: 500 })
  resultValue: string;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  numericValue: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  referenceRange: string;

  @Column({
    type: 'enum',
    enum: AbnormalFlag,
    default: AbnormalFlag.NORMAL,
  })
  abnormalFlag: AbnormalFlag;

  @Column({ type: 'boolean', default: false })
  isDeltaCheck: boolean;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  previousValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  deltaPercentage: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => LabResult, (result) => result.values, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'labResultId' })
  labResult: LabResult;

  @ManyToOne(() => LabTestParameter)
  @JoinColumn({ name: 'parameterId' })
  parameter: LabTestParameter;

  @OneToMany(() => CriticalValueAlert, (alert) => alert.resultValue)
  criticalAlerts: CriticalValueAlert[];
}
