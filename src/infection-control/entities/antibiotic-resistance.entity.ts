import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ResistanceLevel {
  SUSCEPTIBLE = 'susceptible',
  INTERMEDIATE = 'intermediate',
  RESISTANT = 'resistant',
}

@Entity('antibiotic_resistance')
export class AntibioticResistance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  pathogen: string;

  @Column()
  antibiotic: string;

  @Column({ type: 'enum', enum: ResistanceLevel })
  resistanceLevel: ResistanceLevel;

  @Column({ type: 'date' })
  detectedAt: Date;

  @Column({ nullable: true })
  location: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
