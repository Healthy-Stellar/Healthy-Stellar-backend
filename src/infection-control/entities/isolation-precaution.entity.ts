import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PrecautionType {
  CONTACT = 'contact',
  DROPLET = 'droplet',
  AIRBORNE = 'airborne',
  PROTECTIVE = 'protective',
}

@Entity('isolation_precautions')
export class IsolationPrecaution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column({ type: 'enum', enum: PrecautionType })
  precautionType: PrecautionType;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
