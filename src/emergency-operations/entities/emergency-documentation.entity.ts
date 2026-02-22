import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('emergency_chart_notes')
@Index(['patientId', 'createdAt'])
export class EmergencyChartNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @Column({ type: 'uuid', nullable: true })
  providerId: string;

  @Column({ type: 'varchar', length: 80, default: 'rapid_chart' })
  noteType: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  encounterId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum DisasterIncidentStatus {
  ACTIVE = 'active',
  STABILIZING = 'stabilizing',
  CLOSED = 'closed',
}

@Entity('disaster_incidents')
@Index(['status', 'createdAt'])
export class DisasterIncident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60, unique: true })
  incidentCode: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 100 })
  incidentType: string;

  @Column({ type: 'enum', enum: DisasterIncidentStatus, default: DisasterIncidentStatus.ACTIVE })
  status: DisasterIncidentStatus;

  @Column({ type: 'varchar', length: 150, nullable: true })
  location: string;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ type: 'int', default: 0 })
  casualtyCount: number;

  @Column({ type: 'jsonb', nullable: true })
  triageSummary: {
    immediate?: number;
    delayed?: number;
    minor?: number;
    expectant?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  resourceSummary: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  commandLeadId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
