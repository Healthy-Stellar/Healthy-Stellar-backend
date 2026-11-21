import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('tenant_branding')
@Index(['tenantId'], { unique: true })
export class TenantBranding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'logo_url', type: 'varchar', length: 2048, nullable: true })
  logoUrl: string;

  @Column({ name: 'primary_color', type: 'varchar', length: 7, nullable: true })
  primaryColor: string;

  @Column({ name: 'secondary_color', type: 'varchar', length: 7, nullable: true })
  secondaryColor: string;

  @Column({ name: 'custom_domain', type: 'varchar', length: 253, nullable: true })
  customDomain: string;

  @Column({ name: 'support_email', type: 'varchar', length: 254, nullable: true })
  supportEmail: string;

  @Column({ name: 'support_phone', type: 'varchar', length: 30, nullable: true })
  supportPhone: string;

  @Column({ name: 'organization_name', type: 'varchar', length: 255, nullable: true })
  organizationName: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
