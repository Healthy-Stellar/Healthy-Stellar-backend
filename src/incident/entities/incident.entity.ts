import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum IncidentPriority {
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  P4 = 'P4',
}

export enum IncidentState {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
}

export const SLA_MINUTES: Record<IncidentPriority, number> = {
  [IncidentPriority.P1]: 15,
  [IncidentPriority.P2]: 60,
  [IncidentPriority.P3]: 240,
  [IncidentPriority.P4]: 1440,
};

@Entity('incidents')
@Index(['priority', 'state'])
@Index(['createdAt'])
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: IncidentPriority })
  priority: IncidentPriority;

  @Column({ type: 'enum', enum: IncidentState, default: IncidentState.OPEN })
  state: IncidentState;

  @Column({ type: 'varchar', length: 255, nullable: true })
  assignedTo: string;

  @Column({ type: 'timestamp', nullable: true })
  firstResponseAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'int', default: 0 })
  escalationLevel: number;

  @Column({ type: 'timestamp', nullable: true })
  lastEscalatedAt: Date;

  @Column({ type: 'boolean', default: false })
  slaBreach: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
