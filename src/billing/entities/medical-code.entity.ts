import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { CodeType } from '../../common/enums';

@Entity('medical_codes')
@Index(['code', 'codeType'], { unique: true })
export class MedicalCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  @Index()
  code: string;

  @Column({
    type: 'varchar',
    enum: CodeType,
  })
  codeType: CodeType;

  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  longDescription: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  standardCharge: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  subcategory: string;

  @Column({ type: 'date', nullable: true })
  effectiveDate: Date;

  @Column({ type: 'date', nullable: true })
  terminationDate: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'simple-array', nullable: true })
  modifiers: string[];

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
