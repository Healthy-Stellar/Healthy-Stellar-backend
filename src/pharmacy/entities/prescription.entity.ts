import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  prescriptionNumber: string;

  @Column()
  @Index()
  patientId: string;

  @Column()
  providerId: string;

  @Column()
  drugId: string;

  @Column()
  drugName: string;

  @Column()
  dosage: string;

  @Column()
  quantity: number;

  @Column()
  refills: number;

  @Column()
  refillsRemaining: number;

  @Column('text')
  instructions: string;

  @Column('date')
  prescribedDate: Date;

  @Column('date', { nullable: true })
  filledDate: Date;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  pharmacistId: string;

  @Column({ nullable: true })
  verifiedBy: string;

  @Column('timestamp', { nullable: true })
  verifiedAt: Date;

  @Column('simple-json', { nullable: true })
  safetyChecks: any;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
