import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RapidResponseStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

@Entity('rapid_response_events')
@Index(['patientId', 'activatedAt'])
export class RapidResponseEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  patientId: string;

  @Column({ type: 'varchar', length: 80 })
  eventType: string; // rapid_response, code_blue, stroke_alert, etc.

  @Column({ type: 'enum', enum: RapidResponseStatus, default: RapidResponseStatus.ACTIVE })
  status: RapidResponseStatus;

  @Column({ type: 'timestamp' })
  activatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  teamLeadId: string;

  @Column({ type: 'jsonb', nullable: true })
  teamMembers: Array<{ memberId: string; role?: string }>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
