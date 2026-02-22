import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MedicalRecord } from './medical-record.entity';

export enum ClinicalNoteType {
  SOAP = 'soap',
  PROGRESS = 'progress',
  DISCHARGE = 'discharge',
  CONSULTATION = 'consultation',
}

@Entity('clinical_notes')
@Index(['patientId', 'noteType'])
@Index(['medicalRecordId'])
export class ClinicalNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @Column({ type: 'uuid', nullable: true })
  providerId: string;

  @Column({ type: 'uuid', nullable: true })
  medicalRecordId: string;

  @ManyToOne(() => MedicalRecord, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'medicalRecordId' })
  medicalRecord: MedicalRecord;

  @Column({ type: 'enum', enum: ClinicalNoteType, default: ClinicalNoteType.PROGRESS })
  noteType: ClinicalNoteType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  subjective: string;

  @Column({ type: 'text', nullable: true })
  objective: string;

  @Column({ type: 'text', nullable: true })
  assessment: string;

  @Column({ type: 'text', nullable: true })
  plan: string;

  @Column({ type: 'text', nullable: true })
  noteContent: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  isSigned: boolean;

  @Column({ type: 'uuid', nullable: true })
  signedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  signedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  encounterDate: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
