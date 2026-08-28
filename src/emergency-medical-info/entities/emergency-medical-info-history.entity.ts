import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmergencyMedicalInfo } from './emergency-medical-info.entity';

@Entity('emergency_medical_info_history')
@Index(['emergencyMedicalInfoId', 'createdAt'])
@Index(['patientId', 'createdAt'])
export class EmergencyMedicalInfoHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  emergencyMedicalInfoId: string;

  @ManyToOne(() => EmergencyMedicalInfo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'emergencyMedicalInfoId' })
  emergencyMedicalInfo: EmergencyMedicalInfo;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'jsonb', nullable: true })
  previousValues: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  newValues: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  performedBy: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
