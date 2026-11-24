import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';

export enum InfectionStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  DECEASED = 'deceased',
  CONFIRMED = 'confirmed',
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

  @Column({ type: 'varchar', nullable: true })
  @Index()
  tenantId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
