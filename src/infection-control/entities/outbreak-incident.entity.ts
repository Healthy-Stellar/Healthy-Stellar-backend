import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OutbreakStatus {
  INVESTIGATING = 'investigating',
  CONFIRMED = 'confirmed',
  CONTAINED = 'contained',
  RESOLVED = 'resolved',
}

@Entity('outbreak_incidents')
export class OutbreakIncident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  location: string;

  @Column()
  pathogen: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'enum', enum: OutbreakStatus, default: OutbreakStatus.INVESTIGATING })
  status: OutbreakStatus;

  @Column({ type: 'int', default: 0 })
  affectedCount: number;

  @Column({ type: 'text', nullable: true })
  investigationNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
