import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DataResidencyRegion } from '../../enums/data-residency.enum';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ unique: true })
  @Index()
  slug: string;

  @Column({ unique: true, nullable: true })
  stellarContractAddress: string;

  @Column({ nullable: true })
  kmsCmkArn: string;

  @Column({ default: 'active' })
  status: string;

  @Column({
    type: 'varchar',
    enum: DataResidencyRegion,
    default: DataResidencyRegion.EU,
    comment: 'Data residency region for GDPR and compliance requirements',
  })
  @Index()
  region: DataResidencyRegion;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Enforce strict data residency controls',
  })
  strictDataResidency: boolean;

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Allowed client IP ranges for this region',
  })
  allowedIpRanges: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
