import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

export enum HospitalStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum HospitalType {
  GENERAL = 'general',
  SPECIALTY = 'specialty',
  TEACHING = 'teaching',
  REHABILITATION = 'rehabilitation',
  PSYCHIATRIC = 'psychiatric',
  CHILDREN = 'children',
}

@Entity('hospital_registry')
@Index(['licenseNumber'], { unique: true })
export class HospitalRegistry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  licenseNumber: string;

  @Column({ type: 'enum', enum: HospitalType, default: HospitalType.GENERAL })
  type: HospitalType;

  @Column({ type: 'enum', enum: HospitalStatus, default: HospitalStatus.ACTIVE })
  status: HospitalStatus;

  @Column({ type: 'varchar', length: 500 })
  address: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100 })
  country: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'int', nullable: true })
  totalBeds: number;

  @Column({ type: 'text', array: true, default: [] })
  departments: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
