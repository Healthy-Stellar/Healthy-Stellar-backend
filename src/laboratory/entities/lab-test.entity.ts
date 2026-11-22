import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { LabTestParameter } from './lab-test-parameter.entity';

export enum TestCategory {
  HEMATOLOGY = 'hematology',
  CHEMISTRY = 'chemistry',
  MICROBIOLOGY = 'microbiology',
  IMMUNOLOGY = 'immunology',
  SEROLOGY = 'serology',
  URINALYSIS = 'urinalysis',
  COAGULATION = 'coagulation',
  BLOOD_BANK = 'blood_bank',
  MOLECULAR = 'molecular',
  PATHOLOGY = 'pathology',
  OTHER = 'other',
}

export enum SpecimenType {
  BLOOD = 'blood',
  URINE = 'urine',
  STOOL = 'stool',
  TISSUE = 'tissue',
  FLUID = 'fluid',
  SWAB = 'swab',
  OTHER = 'other',
}

export enum TestStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('lab_tests')
export class LabTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  testCode: string;

  @Column()
  testName: string;

  @Column()
  category: string;

  @Column()
  specimenType: string;

  @Column('int')
  turnaroundTime: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('simple-json', { nullable: true })
  referenceRanges: any;

  @Column('text', { nullable: true })
  preparation: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => LabTestParameter, (parameter) => parameter.labTest)
  parameters: LabTestParameter[];
}
