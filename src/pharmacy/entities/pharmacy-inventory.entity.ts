import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { Drug } from './drug.entity';

@Entity('pharmacy_inventory')
export class PharmacyInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Drug, drug => drug.inventory)
  @JoinColumn({ name: 'drug_id' })
  drug: Drug;

  @Column()
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

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  sellingPrice: number;

  @Column()
  location: string; // shelf/bin location

  @Column({ default: 'available' })
  status: string; // available, low-stock, expired, recalled

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}