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

export enum HistoryEventType {
  CREATED = 'created',
  UPDATED = 'updated',
  VIEWED = 'viewed',
  SHARED = 'shared',
  CONSENT_GRANTED = 'consent_granted',
  CONSENT_REVOKED = 'consent_revoked',
  ARCHIVED = 'archived',
  RESTORED = 'restored',
  DELETED = 'deleted',
}

@Entity('medical_history')
@Index(['medicalRecordId', 'eventDate'])
@Index(['patientId', 'eventDate'])
export class MedicalHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  medicalRecordId: string;

  @ManyToOne(() => MedicalRecord, (record) => record.history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'medicalRecordId' })
  medicalRecord: MedicalRecord;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({
    type: 'enum',
    enum: HistoryEventType,
  })
  eventType: HistoryEventType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  eventDescription: string;

  @Column({ type: 'uuid', nullable: true })
  performedBy: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  performedByName: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index()
  eventDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  eventData: Record<string, any>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
