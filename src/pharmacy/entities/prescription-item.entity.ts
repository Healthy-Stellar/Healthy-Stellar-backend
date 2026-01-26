import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Prescription } from './prescription.entity';
import { Drug } from './drug.entity';

@Entity('prescription_items')
export class PrescriptionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prescription, prescription => prescription.items)
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column()
  prescriptionId: string;

  @ManyToOne(() => Drug)
  @JoinColumn({ name: 'drug_id' })
  drug: Drug;

  @Column()
  drugId: string;

  @Column({ type: 'int' })
  quantityPrescribed: number;

  @Column({ type: 'int' })
  quantityDispensed: number;

  @Column()
  dosageInstructions: string; // e.g., "Take 1 tablet by mouth twice daily"

  @Column({ type: 'int', nullable: true })
  daySupply: number;
}