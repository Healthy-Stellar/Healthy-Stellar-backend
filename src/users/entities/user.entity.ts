import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { MedicalRole, UserStatus } from '../enums/medical-role.enum';
import { Patient } from './patient.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'enum', enum: MedicalRole })
  role: MedicalRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING_VERIFICATION })
  status: UserStatus;

  @Column({ nullable: true })
  medicalLicenseNumber: string;

  @Column({ type: 'date', nullable: true })
  licenseExpiryDate: Date;

  @Column({ nullable: true })
  specialization: string;

  @Column({ nullable: true })
  department: string;

  @Column({ default: false })
  isLicenseVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  licenseVerifiedAt: Date;

  @Column({ nullable: true })
  verifiedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  lastAccessRevocationAt: Date;

  @Column({ nullable: true })
  revocationReason: string;

  @OneToOne(() => Patient, (patient) => patient.user, { nullable: true })
  patientProfile: Patient;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
