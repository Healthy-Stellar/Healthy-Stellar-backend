import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('specimens')
export class Specimen {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  specimenId: string;

  @Column()
  @Index()
  orderId: string;

  @Column()
  patientId: string;

  @Column()
  specimenType: string;

  @Column('timestamp')
  collectedAt: Date;

  @Column()
  collectedBy: string;

  @Column({ default: 'collected' })
  status: string;

  @Column({ nullable: true })
  location: string;

  @Column('simple-json', { nullable: true })
  tracking: Array<{ status: string; timestamp: Date; location: string; user: string }>;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
