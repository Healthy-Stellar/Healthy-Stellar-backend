import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Doctor } from './doctor.entity';

export enum ShiftRole {
  SURGEON = 'surgeon',
  NURSE = 'nurse',
  RESIDENT = 'resident',
  ATTENDING = 'attending',
  INTENSIVIST = 'intensivist',
}

/** Qualifications required per ward role. A staff member must have at least one
 *  matching specialization for the role to be valid. */
export const ROLE_REQUIRED_QUALIFICATIONS: Record<ShiftRole, string[]> = {
  [ShiftRole.SURGEON]: ['cardiology', 'orthopedics', 'oncology', 'general_practice', 'emergency_medicine'],
  [ShiftRole.NURSE]: [], // any staff qualifies
  [ShiftRole.RESIDENT]: [],
  [ShiftRole.ATTENDING]: ['cardiology', 'neurology', 'pediatrics', 'orthopedics', 'dermatology', 'psychiatry', 'general_practice', 'emergency_medicine', 'oncology', 'radiology'],
  [ShiftRole.INTENSIVIST]: ['emergency_medicine', 'cardiology', 'neurology'],
};

@Entity('shifts')
@Index(['staffId', 'startTime', 'endTime']) // for overlap queries
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  staffId: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: Doctor;

  @Index()
  @Column({ type: 'uuid' })
  wardId: string;

  @Column({ type: 'enum', enum: ShiftRole })
  role: ShiftRole;

  @Column({ type: 'timestamp with time zone' })
  startTime: Date;

  @Column({ type: 'timestamp with time zone' })
  endTime: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
