import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MedicalRecord } from './medical-record.entity';

@Entity('medical_record_versions')
@Index(['medicalRecordId', 'versionNumber'])
export class MedicalRecordVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  medicalRecordId: string;

  @ManyToOne(() => MedicalRecord, (record) => record.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'medicalRecordId' })
  medicalRecord: MedicalRecord;

  @Column({ type: 'int' })
  versionNumber: number;

  @Column({ type: 'text', nullable: true })
  previousContent: string;

  @Column({ type: 'text', nullable: true })
  currentContent: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, any>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  changeReason: string;

  @Column({ type: 'uuid' })
  changedBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  changedByName: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
