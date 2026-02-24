import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum InfectionStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  DECEASED = 'deceased',
}

@Entity('infection_cases')
export class InfectionCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  infectionType: string;

  @Column()
  pathogen: string;

  @Column({ type: 'date' })
  detectionDate: Date;

  @Column({ type: 'enum', enum: InfectionStatus, default: InfectionStatus.ACTIVE })
  status: InfectionStatus;

  @Column({ nullable: true })
  location: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
