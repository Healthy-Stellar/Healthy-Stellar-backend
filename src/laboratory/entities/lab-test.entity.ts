import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('lab_tests')
export class LabTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  testCode: string;

  @Column()
  testName: string;

  @Column()
  category: string;

  @Column()
  specimenType: string;

  @Column('int')
  turnaroundTime: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('simple-json', { nullable: true })
  referenceRanges: any;

  @Column('text', { nullable: true })
  preparation: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
