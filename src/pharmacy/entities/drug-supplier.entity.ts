import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('drug_suppliers')
export class DrugSupplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  supplierCode: string;

  @Column('text', { nullable: true })
  description: string;

  @Column()
  contactPerson: string;

  @Column()
  email: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  fax: string;

  @Column()
  address: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column()
  zipCode: string;

  @Column()
  country: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  deaNumber: string;

  @Column({ nullable: true })
  licenseNumber: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  reliabilityScore: number; // 0.00 to 1.00

  @Column({ type: 'int', default: 0 })
  averageDeliveryDays: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  onTimeDeliveryRate: number; // percentage

  @Column({ default: false })
  isPreferredSupplier: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column('simple-array', { nullable: true })
  specialties: string[]; // e.g., 'controlled_substances', 'refrigerated', 'specialty_drugs'

  @Column('simple-json', { nullable: true })
  paymentTerms: {
    net: number; // net days
    discountPercent?: number;
    discountDays?: number;
  };

  @Column('simple-json', { nullable: true })
  shippingInfo: {
    minimumOrder?: number;
    freeShippingThreshold?: number;
    standardShippingCost?: number;
    expeditedShippingCost?: number;
  };

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
