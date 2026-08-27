import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum IncidentStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
}

@Entity('consistency_incidents')
@Index(['status', 'createdAt'])
@Index(['checkName', 'status'])
export class ConsistencyIncident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Name of the check that failed (e.g. "lab_results_without_patient") */
  @Column({ type: 'varchar', length: 120 })
  checkName: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: IncidentSeverity, default: IncidentSeverity.MEDIUM })
  severity: IncidentSeverity;

  @Column({ type: 'enum', enum: IncidentStatus, default: IncidentStatus.OPEN })
  status: IncidentStatus;

  @Column({ type: 'int', default: 0 })
  affectedCount: number;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string;

  @Column({ type: 'text', nullable: true })
  resolutionReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
