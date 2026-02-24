import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Drug } from './drug.entity';

@Entity('pharmacy_inventory')
export class PharmacyInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Drug, (drug) => drug.inventory)
  @JoinColumn({ name: 'drug_id' })
  drug: Drug;

  @Column({ type: 'uuid' })
  drugId: string;

  @Column()
  lotNumber: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  reorderLevel: number;

  @Column({ type: 'int' })
  reorderQuantity: number;

  @Column({ type: 'date' })
  expirationDate: Date;

  @Column({ type: 'date', nullable: true })
  manufacturedDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  manufacturer: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  supplierId: string; // Reference to vendor/supplier

  @Column({ type: 'varchar', length: 50, nullable: true })
  purchaseOrderNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  sellingPrice: number;

  @Column()
  location: string; // shelf/bin location

  @Column({ default: 'available' })
  status: string; // available, low-stock, expired, recalled, quarantined

  @Column({ type: 'boolean', default: false })
  isRecalled: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  recallReason: string;

  @Column({ type: 'date', nullable: true })
  recallDate: Date;

  @Column({ type: 'boolean', default: false })
  isFormularyDrug: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  formularyTier: string; // preferred, non-preferred, etc.

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  formularyCopay: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
