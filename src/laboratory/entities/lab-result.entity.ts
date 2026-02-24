import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('lab_results')
export class LabResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  orderId: string;

  @Column()
  testId: string;

  @Column()
  testCode: string;

  @Column()
  testName: string;

  @Column()
  result: string;

  @Column()
  unit: string;

  @Column({ nullable: true })
  referenceRange: string;

  @Column({ default: 'normal' })
  flag: string;

  @Column({ default: 'final' })
  status: string;

  @Column()
  performedBy: string;

  @Column('timestamp')
  performedAt: Date;

  @Column({ nullable: true })
  verifiedBy: string;

  @Column('timestamp', { nullable: true })
  verifiedAt: Date;

  @Column('text', { nullable: true })
  comments: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
