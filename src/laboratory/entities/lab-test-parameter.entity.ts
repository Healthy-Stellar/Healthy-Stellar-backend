import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LabTest } from './lab-test.entity';

export enum ParameterDataType {
  NUMERIC = 'numeric',
  TEXT = 'text',
  CODED = 'coded',
  BOOLEAN = 'boolean',
}

export enum AbnormalFlag {
  NORMAL = 'normal',
  LOW = 'low',
  HIGH = 'high',
  CRITICAL_LOW = 'critical_low',
  CRITICAL_HIGH = 'critical_high',
}

@Entity('lab_test_parameters')
@Index(['labTestId'])
export class LabTestParameter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  labTestId: string;

  @Column({ type: 'varchar', length: 100 })
  parameterName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  parameterCode: string;

  @Column({
    type: 'enum',
    enum: ParameterDataType,
    default: ParameterDataType.NUMERIC,
  })
  dataType: ParameterDataType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  normalRangeLow: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  normalRangeHigh: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  criticalLow: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  criticalHigh: number;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Age and gender-specific reference ranges',
  })
  referenceRanges: Array<{
    ageMin?: number;
    ageMax?: number;
    gender?: 'male' | 'female' | 'other';
    normalLow?: number;
    normalHigh?: number;
    criticalLow?: number;
    criticalHigh?: number;
    unit?: string;
  }>;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => LabTest, (labTest) => labTest.parameters, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'labTestId' })
  labTest: LabTest;
}
