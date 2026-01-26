import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, ManyToMany, JoinTable } from 'typeorm';

export enum SpecializationType {
  CARDIOLOGY = 'cardiology',
  NEUROLOGY = 'neurology',
  PEDIATRICS = 'pediatrics',
  ORTHOPEDICS = 'orthopedics',
  DERMATOLOGY = 'dermatology',
  PSYCHIATRY = 'psychiatry',
  GENERAL_PRACTICE = 'general_practice',
  EMERGENCY_MEDICINE = 'emergency_medicine',
  ONCOLOGY = 'oncology',
  RADIOLOGY = 'radiology'
}

export enum LicenseStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  REVOKED = 'revoked',
  PENDING_RENEWAL = 'pending_renewal'
}

export enum StaffStatus {
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated'
}

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  phone: string;

  @Column({ type: 'date' })
  dateOfBirth: Date;

  @Column({ type: 'enum', enum: SpecializationType, array: true })
  specializations: SpecializationType[];

  @Column()
  medicalLicenseNumber: string;

  @Column({ type: 'date' })
  licenseIssueDate: Date;

  @Column({ type: 'date' })
  licenseExpiryDate: Date;

  @Column({ type: 'enum', enum: LicenseStatus, default: LicenseStatus.ACTIVE })
  licenseStatus: LicenseStatus;

  @Column({ nullable: true })
  boardCertification: string;

  @Column({ type: 'date', nullable: true })
  boardCertificationExpiry: Date;

  @Column()
  yearsOfExperience: number;

  @Column({ type: 'enum', enum: StaffStatus, default: StaffStatus.ACTIVE })
  status: StaffStatus;

  @Column({ type: 'jsonb', nullable: true })
  credentials: {
    degree: string;
    institution: string;
    graduationYear: number;
  }[];

  @ManyToOne(() => Department, department => department.doctors)
  department: Department;

  @OneToMany(() => Schedule, schedule => schedule.doctor)
  schedules: Schedule[];

  @OneToMany(() => PerformanceMetric, metric => metric.doctor)
  performanceMetrics: PerformanceMetric[];

  @OneToMany(() => ContinuingEducation, education => education.doctor)
  continuingEducation: ContinuingEducation[];

  @ManyToMany(() => Specialty, specialty => specialty.doctors)
  @JoinTable()
  specialties: Specialty[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
