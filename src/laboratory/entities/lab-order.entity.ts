import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('lab_orders')
export class LabOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  orderNumber: string;

  @Column()
  @Index()
  patientId: string;

  @Column()
  providerId: string;

  @Column('simple-json')
  tests: Array<{ testId: string; testCode: string; testName: string }>;

  @Column({ default: 'pending' })
  status: string;

  @Column('date')
  orderDate: Date;

  @Column('date', { nullable: true })
  collectionDate: Date;

  @Column({ nullable: true })
  specimenId: string;

  @Column({ default: 'routine' })
  priority: string;

  @Column('text', { nullable: true })
  clinicalInfo: string;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
