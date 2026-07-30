import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { IncidentType } from '../../healthcare-monitoring/entities/healthcare-incident.entity';

@Entity('runbook_mappings')
export class RunbookMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: IncidentType, unique: true })
  @Index({ unique: true })
  incidentCategory: IncidentType;

  @Column({ length: 100 })
  runbookId: string;

  @Column({ length: 255 })
  runbookTitle: string;

  @Column('text')
  runbookUrl: string;

  @Column('simple-array', { nullable: true })
  steps: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
