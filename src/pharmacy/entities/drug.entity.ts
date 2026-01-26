import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PharmacyInventory } from './pharmacy-inventory.entity';
import { DrugInteraction } from './drug-interaction.entity';

@Entity('drugs')
export class Drug {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 11 })
  ndcCode: string; // National Drug Code (10 or 11 digits)

  @Column()
  brandName: string;

  @Column()
  genericName: string;

  @Column('text')
  description: string;

  @Column()
  manufacturer: string;

  @Column()
  dosageForm: string; // tablet, capsule, liquid, injection, etc.

  @Column()
  strength: string; // e.g., "500mg", "10mg/ml"

  @Column()
  route: string; // oral, IV, topical, etc.

  @Column({ type: 'enum', enum: ['I', 'II', 'III', 'IV', 'V', 'non-controlled'] })
  controlledSubstanceSchedule: string;

  @Column('simple-array', { nullable: true })
  therapeuticClasses: string[];

  @Column('simple-array', { nullable: true })
  indications: string[];

  @Column('simple-array', { nullable: true })
  contraindications: string[];

  @Column('text', { nullable: true })
  warnings: string;

  @Column('text', { nullable: true })
  sideEffects: string;

  @Column({ default: true })
  requiresPrescription: boolean;

  @Column({ default: false })
  isRefrigerated: boolean;

  @Column({ default: false })
  isHazardous: boolean;

  @Column({ default: true })
  isActive: true;

  @OneToMany(() => PharmacyInventory, inventory => inventory.drug)
  inventory: PharmacyInventory[];

  @OneToMany(() => DrugInteraction, interaction => interaction.drug1)
  interactions1: DrugInteraction[];

  @OneToMany(() => DrugInteraction, interaction => interaction.drug2)
  interactions2: DrugInteraction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}