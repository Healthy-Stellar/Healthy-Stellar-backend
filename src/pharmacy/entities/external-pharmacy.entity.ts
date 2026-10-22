import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('external_pharmacies')
export class ExternalPharmacy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  @Index()
  ncpdpId: string;

  @Column({ nullable: true })
  npi: string;

  @Column('json', { nullable: true })
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  fax: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  supportsElectronicPrescribing: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
