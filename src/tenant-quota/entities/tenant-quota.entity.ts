import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantTier } from '../interfaces/quota-tier.interface';

/**
 * Persists per-tenant quota limits.
 * One row per tenant – created automatically with tier defaults on first access.
 */
@Entity('tenant_quotas')
@Index(['tenantId'], { unique: true })
export class TenantQuota {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Foreign key to whichever tenant entity your project uses. */
  @Column({ name: 'tenant_id', type: 'varchar', length: 255 })
  tenantId: string;

  /** Pricing tier – drives default limits. */
  @Column({
    name: 'tier',
    type: 'varchar',
    length: 50,
    default: 'free',
  })
  tier: TenantTier;

  /**
   * Custom overrides – NULL means "use tier default".
   * This lets you grant a single tenant higher limits without upgrading their tier.
   */
  @Column({ name: 'custom_records_per_month', type: 'int', nullable: true })
  customRecordsPerMonth: number | null;

  @Column({ name: 'custom_storage_bytes', type: 'bigint', nullable: true })
  customStorageBytes: number | null;

  @Column({ name: 'custom_api_calls_per_hour', type: 'int', nullable: true })
  customApiCallsPerHour: number | null;

  @Column({
    name: 'custom_bulk_operations_concurrent',
    type: 'int',
    nullable: true,
  })
  customBulkOperationsConcurrent: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}