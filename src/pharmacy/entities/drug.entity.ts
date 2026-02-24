import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('drugs')
export class Drug {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  ndc: string;

  @Column()
  name: string;

  @Column()
  genericName: string;

  @Column()
  manufacturer: string;

  @Column()
  dosageForm: string;

  @Column()
  strength: string;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column('int')
  quantityOnHand: number;

  @Column('int')
  reorderLevel: number;

  @Column('int')
  reorderQuantity: number;

  @Column()
  lotNumber: string;

  @Column('date')
  expirationDate: Date;

  @Column({ default: 'active' })
  status: string;

  @Column('simple-json', { nullable: true })
  interactions: string[];

  @Column('simple-json', { nullable: true })
  contraindications: string[];

  @Column({ default: false })
  requiresRefrigeration: boolean;

  @Column({ default: false })
  controlledSubstance: boolean;

  @Column({ nullable: true })
  scheduleClass: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
