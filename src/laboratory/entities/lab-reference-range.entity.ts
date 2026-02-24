import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LabTestParameter } from './lab-test-parameter.entity';

export enum ReferenceRangeType {
  NORMAL = 'normal',
  CRITICAL_LOW = 'critical_low',
  CRITICAL_HIGH = 'critical_high',
  PANIC_LOW = 'panic_low',
  PANIC_HIGH = 'panic_high',
  THERAPEUTIC = 'therapeutic',
  TOXIC = 'toxic',
}

export enum AgeGroup {
  NEWBORN = 'newborn',
  INFANT = 'infant',
  CHILD = 'child',
  ADOLESCENT = 'adolescent',
  ADULT = 'adult',
  ELDERLY = 'elderly',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  ALL = 'all',
}

@Entity('lab_reference_ranges')
export class LabReferenceRange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'test_parameter_id' })
  testParameterId: string;

  @ManyToOne(() => LabTestParameter)
  @JoinColumn({ name: 'test_parameter_id' })
  testParameter: LabTestParameter;

  @Column({ type: 'enum', enum: ReferenceRangeType })
  type: ReferenceRangeType;

  @Column({ type: 'enum', enum: AgeGroup, default: AgeGroup.ADULT })
  ageGroup: AgeGroup;

  @Column({ type: 'enum', enum: Gender, default: Gender.ALL })
  gender: Gender;

  @Column({ name: 'min_age', nullable: true })
  minAge: number; // in years

  @Column({ name: 'max_age', nullable: true })
  maxAge: number; // in years

  @Column({ name: 'lower_limit', type: 'decimal', precision: 10, scale: 4, nullable: true })
  lowerLimit: number;

  @Column({ name: 'upper_limit', type: 'decimal', precision: 10, scale: 4, nullable: true })
  upperLimit: number;

  @Column({ name: 'text_value', nullable: true })
  textValue: string;

  @Column()
  unit: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'effective_from' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', nullable: true })
  effectiveTo: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
